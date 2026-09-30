import {
  acceptCourseDistance,
  courseKeepLimit,
  COURSE_POOL_LIMIT,
  COURSE_PROPOSAL_LIMIT,
  keepCourseDistance,
  countCrossedSignals,
  countNearRoute,
  courseScoreParts,
  elevationChange,
  featureLengthKm,
  lengthNearLinesKm,
  loopWaypointSets,
  MAJOR_ROAD_NEAR_METERS,
  majorIntersections,
  MAP_SERVICE_MESSAGE,
  nearestMajorBearing,
  overlapRatio,
  OVERLAP_REJECT_RATIO,
  parseElevations,
  parseOsrmRoute,
  parseOverpass,
  preferDistinctRoutes,
  routeLengthKm,
  sampleRoute,
  shouldRetryMapService,
  SHAPE_ADJUST_LIMIT,
  shouldContinueShapeAdjust,
  shuffleWaypointSets,
  SIGNAL_NEAR_METERS,
  stepShapeScale,
  straightStats,
  turnCount,
  type CourseScoreParts,
  type LatLon,
} from "../courses";

const FOOT_ROUTE_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const USER_AGENT = "PaceCast/0.1 (course proposals)";

const MAP_RETRY_PAUSE_MS = 8_000;

export class CourseRouteError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "CourseRouteError";
    this.retryable = retryable;
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
  majorKm: number;
  overlapRatio: number;
  junctionCount: number;
  score: number;
  scoreParts: CourseScoreParts;
};

const EMPTY_SCORE: CourseScoreParts = {
  distance: 0,
  major: 0,
  straight: 0,
  turns: 0,
  overlap: 0,
  signals: 0,
  junctions: 0,
  total: 0,
};

export type CourseProposalSet = {
  courses: BuiltRoute[];
};

async function fetchJson(
  url: string,
  timeoutMs: number,
  message: string,
  init?: RequestInit,
  retryable = false,
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new CourseRouteError(message, retryable);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof CourseRouteError) {
      throw error;
    }
    throw new CourseRouteError(message, retryable);
  }
}

async function routeOnFoot(points: LatLon[]): Promise<{ distanceKm: number; coordinates: LatLon[] } | "down" | null> {
  const path = points.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`).join(";");
  const url = `${FOOT_ROUTE_URL}${path}?overview=full&geometries=geojson&continue_straight=false`;
  try {
    const payload = await fetchJson(url, 20_000, MAP_SERVICE_MESSAGE, undefined, true);
    return parseOsrmRoute(payload);
  } catch (error) {
    if (error instanceof CourseRouteError && error.retryable) {
      return "down";
    }
    throw error;
  }
}

function distanceMeters(left: LatLon, right: LatLon): number {
  const scale = 111_320;
  const lonScale = scale * Math.cos((left.lat * Math.PI) / 180);
  return Math.hypot((right.lon - left.lon) * lonScale, (right.lat - left.lat) * scale);
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
      majorKm: 0,
      overlapRatio: 0,
      junctionCount: 0,
      score: 0,
      scoreParts: EMPTY_SCORE,
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
  const payload = await fetchJson(OVERPASS_URL, 50_000, MAP_SERVICE_MESSAGE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  }, true);
  return parseOverpass(payload);
}

async function loadElevation(coordinates: LatLon[]): Promise<{ ascentM: number; descentM: number }> {
  const spacing = Math.max(200, (routeLengthKm(coordinates) * 1000) / 70);
  const samples = sampleRoute(coordinates, spacing, 80);
  const url = new URL(ELEVATION_URL);
  url.searchParams.set("latitude", samples.map((point) => point.lat.toFixed(5)).join(","));
  url.searchParams.set("longitude", samples.map((point) => point.lon.toFixed(5)).join(","));
  const payload = await fetchJson(url.toString(), 20_000, MAP_SERVICE_MESSAGE, undefined, true);
  const heights = parseElevations(payload);
  if (heights.length === 0) {
    throw new CourseRouteError(MAP_SERVICE_MESSAGE, true);
  }
  return elevationChange(heights);
}

async function collectRoutes(
  start: LatLon,
  loopKm: number,
  majors: LatLon[][],
  onProgress?: (finished: number, total: number, passed: number) => void,
): Promise<BuiltRoute[]> {
  const bearing = nearestMajorBearing(start, majors);
  let scale = 1;
  const gathered: BuiltRoute[] = [];
  let down = 0;
  let answered = 0;
  let finished = 0;
  let total = 0;
  for (let pass = 0; pass <= SHAPE_ADJUST_LIMIT; pass += 1) {
    const sets = shuffleWaypointSets(loopWaypointSets(start, loopKm, bearing, majors, scale));
    total += sets.length;
    const planned = pass < SHAPE_ADJUST_LIMIT ? total + sets.length : total;
    const passedNow = () =>
      gathered.filter(
        (route) => keepCourseDistance(route.distanceKm, loopKm) && overlapRatio(route.coordinates) <= OVERLAP_REJECT_RATIO,
      ).length;
    const reportPlanned = () => onProgress?.(finished, planned, passedNow());
    reportPlanned();
    const passAccepted: number[] = [];
    const passKept: number[] = [];
    let cursor = 0;
    let stop = false;
    async function searchOne(): Promise<void> {
      while (cursor < sets.length && !stop) {
        if (passedNow() >= courseKeepLimit(loopKm)) {
          stop = true;
          break;
        }
        const points = sets[cursor];
        cursor += 1;
        let result: Awaited<ReturnType<typeof routeOnFoot>>;
        try {
          result = await routeOnFoot(points);
        } finally {
          finished += 1;
          reportPlanned();
        }
        if (result === "down") {
          down += 1;
          continue;
        }
        answered += 1;
        const kept = keepCourse(result);
        gathered.push(...kept);
        for (const route of kept) {
          passKept.push(route.distanceKm);
          if (keepCourseDistance(route.distanceKm, loopKm) && overlapRatio(route.coordinates) <= OVERLAP_REJECT_RATIO) {
            passAccepted.push(route.distanceKm);
          }
        }
        if (passedNow() >= courseKeepLimit(loopKm)) {
          stop = true;
          onProgress?.(finished, finished, passedNow());
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, sets.length) }, () => searchOne()));
    const inBand = gathered.filter(
      (route) => keepCourseDistance(route.distanceKm, loopKm) && overlapRatio(route.coordinates) <= OVERLAP_REJECT_RATIO,
    ).length;
    const medianSource = passAccepted.length > 0 ? passAccepted : passKept;
    const median = medianSource.length > 0 ? medianNumber(medianSource) : 0;
    if (!shouldContinueShapeAdjust(inBand, median, loopKm, pass)) {
      if (finished > 0) {
        onProgress?.(finished, finished, inBand);
      }
      break;
    }
    const next = stepShapeScale(scale, median, loopKm);
    if (Math.abs(next - scale) < 1e-9) {
      if (finished > 0) {
        onProgress?.(finished, finished, inBand);
      }
      break;
    }
    scale = next;
  }
  const accepted = gathered.filter(
    (route) => keepCourseDistance(route.distanceKm, loopKm) && overlapRatio(route.coordinates) <= OVERLAP_REJECT_RATIO,
  );
  if (accepted.length > 0) {
    return accepted;
  }
  if (gathered.length === 0 && down > 0 && answered === 0) {
    throw new CourseRouteError(MAP_SERVICE_MESSAGE, true);
  }
  throw new CourseRouteError("希望の距離に近い周回を作れませんでした。距離を変えて、もう一度試してください");
}

function medianNumber(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function proposeCoursesOnce(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number) => void,
): Promise<CourseProposalSet> {
  const mapContext = await loadMapContext(start, distanceKm);
  const routes = await collectRoutes(start, distanceKm, mapContext.majors, onProgress);
  const junctions = majorIntersections(mapContext.majors);
  const distinct = preferDistinctRoutes(
    routes.map((route) => {
      const majorKm = lengthNearLinesKm(route.coordinates, mapContext.majors, MAJOR_ROAD_NEAR_METERS);
      const overlap = overlapRatio(route.coordinates);
      const straight = straightStats(route.coordinates);
      const signalCount = countCrossedSignals(
        route.coordinates,
        mapContext.signals,
        SIGNAL_NEAR_METERS,
        mapContext.majors,
      );
      const featureKm = featureLengthKm(route.coordinates, mapContext.parks, mapContext.waters);
      const junctionCount = countNearRoute(route.coordinates, junctions, 25);
      const scoreParts = courseScoreParts({
        distanceKm: route.distanceKm,
        targetKm: distanceKm,
        majorRatio: route.distanceKm > 0 ? majorKm / route.distanceKm : 0,
        turnCount: route.turnCount,
        signalCount,
        junctionCount,
        overlapRatio: overlap,
        meanLegMeters: straight.meanLegMeters,
        longestLegMeters: straight.longestLegMeters,
        shortLegCount: straight.shortLegCount,
      });
      return {
        ...route,
        signalCount,
        featureKm,
        majorKm,
        overlapRatio: overlap,
        junctionCount,
        score: scoreParts.total,
        scoreParts,
      };
    }),
    COURSE_POOL_LIMIT,
  );
  const ranked = distinct.slice(0, COURSE_PROPOSAL_LIMIT);
  const courses = await mapPool(ranked, 2, async (route) => {
    try {
      const relief = await loadElevation(route.coordinates);
      return { ...route, ...relief };
    } catch (error) {
      if (error instanceof CourseRouteError && error.retryable) {
        return route;
      }
      throw error;
    }
  });
  return { courses };
}

export async function proposeCourses(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number) => void,
): Promise<CourseProposalSet> {
  const started = Date.now();
  try {
    onProgress?.(0, 0, 0);
    return await proposeCoursesOnce(start, distanceKm, onProgress);
  } catch (error) {
    if (!(error instanceof CourseRouteError) || !shouldRetryMapService(Date.now() - started, error.retryable)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, MAP_RETRY_PAUSE_MS));
    onProgress?.(0, 0, 0);
    return await proposeCoursesOnce(start, distanceKm, onProgress);
  }
}
