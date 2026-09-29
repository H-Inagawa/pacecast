import { INTENSITY_LABELS } from "../intensity";
import {
  acceptRetracedCourse,
  circleWaypoints,
  compareCourses,
  countNearRoute,
  elevationChange,
  featureLengthKm,
  lengthNearLinesKm,
  LOOP_WAYPOINT_COUNT,
  MAJOR_ROAD_NEAR_METERS,
  majorIntersections,
  nearestOnLines,
  parseElevations,
  parseOsrmRoute,
  parseOverpass,
  orderLoopVias,
  pickIntersectionVias,
  radiusScaleFromLengths,
  routeLengthKm,
  sampleRoute,
  SIGNAL_NEAR_METERS,
  snapLimitMeters,
  turnCount,
  waypointsAreSpread,
  COURSE_DIRECTIONS_DEG,
  type LatLon,
} from "../courses";
import { nearestStation } from "../nearest-station";
import { predictPerformance } from "./prediction";
import { fetchForecastCondition } from "./forecast";
import { listStations, type AmedasStation } from "./amedas";
import { targetWbgt } from "./weather";
import { getOrCreateProfile, intensityLabel, resolveTargetHr } from "./profile";
import { loadPredictRuns } from "./runs";
import type { AuthUserRow } from "./types";

const FOOT_ROUTE_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const USER_AGENT = "PaceCast/0.1 (course proposals)";

export class CourseRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseRouteError";
  }
}

type BuiltRoute = {
  distanceKm: number;
  coordinates: LatLon[];
  turnCount: number;
  signalCount: number;
  featureKm: number;
  ascentM: number;
  descentM: number;
};

export type CourseProposal = BuiltRoute & {
  prediction: {
    paceSecPerKm: number;
    durationSec: number;
    rmseSecPerKm: number;
    confidence: string;
    sampleCount: number;
    rSquared: number;
  } | null;
};

export type CourseProposalSet = {
  stationName: string;
  courses: CourseProposal[];
};

async function fetchJson(url: string, timeoutMs: number, message: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new CourseRouteError(message);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof CourseRouteError) {
      throw error;
    }
    throw new CourseRouteError(message);
  }
}

async function routeOnFoot(points: LatLon[]): Promise<{ distanceKm: number; coordinates: LatLon[] } | null> {
  const path = points.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`).join(";");
  const url = `${FOOT_ROUTE_URL}${path}?overview=full&geometries=geojson&continue_straight=false`;
  try {
    const payload = await fetchJson(url, 20_000, "周回コースを作れませんでした");
    return parseOsrmRoute(payload);
  } catch (error) {
    if (error instanceof CourseRouteError) {
      return null;
    }
    throw error;
  }
}

function spacedPoints(points: LatLon[]): LatLon[] {
  const kept: LatLon[] = [];
  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous && distanceMeters(previous, point) < 40) {
      continue;
    }
    kept.push(point);
  }
  const start = points[0];
  const last = kept[kept.length - 1];
  if (start && (!last || distanceMeters(last, start) >= 40)) {
    kept.push(start);
  }
  return kept;
}

function distanceMeters(left: LatLon, right: LatLon): number {
  const scale = 111_320;
  const lonScale = scale * Math.cos((left.lat * Math.PI) / 180);
  return Math.hypot((right.lon - left.lon) * lonScale, (right.lat - left.lat) * scale);
}

function majorWaypoints(start: LatLon, loopKm: number, angleOffsetDeg: number, radiusScale: number, majors: LatLon[][]): LatLon[] | null {
  const limit = snapLimitMeters(loopKm);
  const ideals = circleWaypoints(start, loopKm, angleOffsetDeg, radiusScale, LOOP_WAYPOINT_COUNT);
  const snapped = ideals.map((point) => nearestOnLines(point, majors, limit) ?? point);
  const ordered = orderLoopVias(start, snapped);
  if (ordered == null) {
    return null;
  }
  const points = spacedPoints([start, ...ordered, start]);
  if (!waypointsAreSpread(start, points, loopKm)) {
    return null;
  }
  return points;
}

async function routesForScale(
  start: LatLon,
  loopKm: number,
  radiusScale: number,
  majors: LatLon[][],
  angleShift = 0,
): Promise<BuiltRoute[]> {
  const jobs = COURSE_DIRECTIONS_DEG.map((angle) => async () => {
    const waypoints = majorWaypoints(start, loopKm, angle + angleShift, radiusScale, majors);
    if (waypoints == null) {
      return null;
    }
    return routeOnFoot(waypoints);
  });
  const settled = await mapPool(jobs, 2, (job) => job());
  return settled.flatMap((route) => keepCourse(route));
}

async function routesFromIntersections(
  start: LatLon,
  loopKm: number,
  radiusScale: number,
  majors: LatLon[][],
): Promise<BuiltRoute[]> {
  const sets = pickIntersectionVias(start, loopKm * radiusScale, majorIntersections(majors));
  const jobs = sets.map((vias) => async () => {
    const waypoints = spacedPoints([start, ...vias, start]);
    if (!waypointsAreSpread(start, waypoints, loopKm)) {
      return null;
    }
    return routeOnFoot(waypoints);
  });
  const settled = await mapPool(jobs, 2, (job) => job());
  return settled.flatMap((route) => keepCourse(route));
}

function keepCourse(route: { distanceKm: number; coordinates: LatLon[] } | null): BuiltRoute[] {
  if (route == null) {
    return [];
  }
  const coordinates = route.coordinates;
  const distanceKm = routeLengthKm(coordinates);
  const closed = coordinates.length >= 4 && distanceMeters(coordinates[0], coordinates[coordinates.length - 1]) <= 40;
  if (!closed) {
    return [];
  }
  return [
    {
      ...route,
      coordinates,
      distanceKm,
      turnCount: turnCount(coordinates),
      signalCount: 0,
      featureKm: 0,
      ascentM: 0,
      descentM: 0,
    },
  ];
}

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function searchBounds(start: LatLon, loopKm: number): { south: number; west: number; north: number; east: number } {
  const radiusKm = (loopKm / (2 * Math.PI)) * 1.8;
  const latPad = radiusKm / 111;
  const lonPad = radiusKm / (111 * Math.max(0.2, Math.cos((start.lat * Math.PI) / 180)));
  return {
    south: start.lat - latPad,
    north: start.lat + latPad,
    west: start.lon - lonPad,
    east: start.lon + lonPad,
  };
}

async function loadMapContext(start: LatLon, loopKm: number) {
  const box = searchBounds(start, loopKm);
  const query = `[out:json][timeout:40];
(
  way["highway"~"^(trunk|primary|secondary|tertiary)(_link)?$"](${box.south},${box.west},${box.north},${box.east});
  node["highway"="traffic_signals"](${box.south},${box.west},${box.north},${box.east});
  way["leisure"="park"](${box.south},${box.west},${box.north},${box.east});
  way["landuse"="recreation_ground"](${box.south},${box.west},${box.north},${box.east});
  way["waterway"~"river|stream|canal"](${box.south},${box.west},${box.north},${box.east});
);
out geom;`;
  const payload = await fetchJson(OVERPASS_URL, 50_000, "周回コースを作れませんでした", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  return parseOverpass(payload);
}

async function loadElevation(coordinates: LatLon[]): Promise<{ ascentM: number; descentM: number }> {
  const spacing = Math.max(200, (routeLengthKm(coordinates) * 1000) / 70);
  const samples = sampleRoute(coordinates, spacing, 80);
  const url = new URL(ELEVATION_URL);
  url.searchParams.set("latitude", samples.map((point) => point.lat.toFixed(5)).join(","));
  url.searchParams.set("longitude", samples.map((point) => point.lon.toFixed(5)).join(","));
  const payload = await fetchJson(url.toString(), 20_000, "周回コースを作れませんでした");
  const heights = parseElevations(payload);
  if (heights.length === 0) {
    throw new CourseRouteError("周回コースを作れませんでした");
  }
  return elevationChange(heights);
}

async function collectRoutes(start: LatLon, loopKm: number, majors: LatLon[][]): Promise<BuiltRoute[]> {
  const accepted: BuiltRoute[] = [];
  for (const shift of [0, 15]) {
    let scale = 1;
    const lengths: number[] = [];
    for (let pass = 0; pass < 3 && accepted.length < 3; pass += 1) {
      if (pass > 0) {
        const next = radiusScaleFromLengths(lengths, loopKm);
        if (Math.abs(next - scale) <= 0.05) {
          break;
        }
        scale = next;
      }
      const circled = await routesForScale(start, loopKm, scale, majors, shift);
      const circledAccepted = circled.filter((route) => acceptRetracedCourse(route.distanceKm, route.coordinates, loopKm));
      const joined =
        accepted.length + circledAccepted.length >= 3
          ? []
          : await routesFromIntersections(start, loopKm, scale, majors);
      const batch = [...circled, ...joined];
      lengths.push(...batch.map((route) => route.distanceKm));
      accepted.push(...batch.filter((route) => acceptRetracedCourse(route.distanceKm, route.coordinates, loopKm)));
    }
    if (accepted.length >= 3) {
      return accepted;
    }
  }
  if (accepted.length > 0) {
    return accepted;
  }
  throw new CourseRouteError("希望の距離に近い周回を作れませんでした。距離を変えて、もう一度試してください");
}

function nearestAmedas(stations: AmedasStation[], start: LatLon): AmedasStation {
  const match = nearestStation(
    stations.map((station) => ({
      station_id: station.stationId,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      prefecture: station.prefecture,
    })),
    start.lat,
    start.lon,
  );
  const found = stations.find((station) => station.stationId === match?.station_id);
  if (found == null) {
    throw new CourseRouteError("起点に近いアメダス地点が見つかりません");
  }
  return found;
}

export async function proposeCourses(
  user: AuthUserRow,
  start: LatLon,
  distanceKm: number,
  intensityKey: string,
): Promise<CourseProposalSet> {
  const mapContext = await loadMapContext(start, distanceKm);
  const routes = await collectRoutes(start, distanceKm, mapContext.majors);
  const ranked = routes
    .map((route) => {
      const majorKm = lengthNearLinesKm(route.coordinates, mapContext.majors, MAJOR_ROAD_NEAR_METERS);
      return {
        ...route,
        signalCount: countNearRoute(route.coordinates, mapContext.signals, SIGNAL_NEAR_METERS),
        featureKm: featureLengthKm(route.coordinates, mapContext.parks, mapContext.waters),
        majorRatio: route.distanceKm > 0 ? majorKm / route.distanceKm : 0,
      };
    })
    .sort(compareCourses)
    .slice(0, 3);
  const withRelief = await mapPool(ranked, 2, async (route) => {
    const relief = await loadElevation(route.coordinates);
    return { ...route, ...relief };
  });
  const stations = await listStations();
  const station = nearestAmedas(stations, start);
  const now = new Date();
  const forecast = await fetchForecastCondition(now, station.latitude, station.longitude, station.name);
  const wbgt = await targetWbgt(forecast.temperatureC, forecast.humidityPct, forecast.observedAt, station, forecast);
  const profile = await getOrCreateProfile(user);
  const runs = await loadPredictRuns(user.id);
  const targetHr = resolveTargetHr(profile, intensityKey);
  const label = intensityLabel(intensityKey) || INTENSITY_LABELS[intensityKey] || intensityKey;
  const courses = withRelief.map((route) => {
    const predicted = predictPerformance(runs, wbgt, route.distanceKm, {
      intensityKey,
      intensityLabel: label,
      targetHr,
      personalPriorK: profile.personal_prior_k,
    });
    return {
      ...route,
      turnCount: turnCount(route.coordinates),
      prediction:
        predicted == null
          ? null
          : {
              paceSecPerKm: predicted.predictedPaceSecPerKm,
              durationSec: predicted.predictedDurationSec,
              rmseSecPerKm: predicted.rmseSecPerKm,
              confidence: predicted.confidence,
              sampleCount: predicted.sampleCount,
              rSquared: predicted.rSquared,
            },
    };
  });
  return { stationName: station.name, courses };
}
