import {
  acceptCourseDistance,
  chooseNearMisses,
  COURSE_CANDIDATE_LIMIT,
  COURSE_PROPOSAL_LIMIT,
  countNearRoute,
  countUturns,
  courseScoreParts,
  elevationChange,
  featureLengthKm,
  HIGHWAY_SEARCH_LEVEL_MAX,
  highwaySearchLevel,
  isEasyRoad,
  courseRoadStarts,
  courseRoadStartLimit,
  courseStemSearchLimit,
  facesNarrowRoad,
  pointInPark,
  lengthNearLinesKm,
  MAJOR_ROAD_NEAR_METERS,
  majorIntersections,
  MAP_SERVICE_MESSAGE,
  NEAR_COURSE_NOTICE,
  overlapRatio,
  OVERLAP_REJECT_RATIO,
  parseElevations,
  parseOverpass,
  routeLengthKm,
  sameCourseLine,
  sampleRoute,
  shouldRetryMapService,
  straightenShortSpikes,
  straightStats,
  turnCount,
  type CourseScoreParts,
  type LatLon,
} from "../courses";
import { coursesWithAccessStem, departureBearings, exploreClockwiseLoops, loopTravelSector, nearestWayMeters, returnToStartLoops, SearchStopped, type ExploredLoop } from "../course-network";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const USER_AGENT = "PaceCast/0.1 (course proposals)";

const MAP_RETRY_PAUSE_MS = 8_000;

function headingsCoverReverse(bearings: number[]): boolean {
  for (let index = 0; index < bearings.length; index += 1) {
    for (let other = index + 1; other < bearings.length; other += 1) {
      const diff = Math.abs(bearings[index] - bearings[other]) % 360;
      const turn = Math.min(diff, 360 - diff);
      if (turn >= 120) {
        return true;
      }
    }
  }
  return false;
}

function preferSpreadDirections<T extends { coordinates: LatLon[]; score: number; featureKm?: number }>(
  start: LatLon,
  routes: T[],
  limit: number,
): T[] {
  const ranked = [...routes].sort(
    (left, right) => right.score - left.score || (right.featureKm ?? 0) - (left.featureKm ?? 0),
  );
  const kept: T[] = [];
  const usedSectors = new Set<number>();
  for (const route of ranked) {
    const sector = loopTravelSector(start, route.coordinates);
    if (usedSectors.has(sector) || kept.some((existing) => sameCourseLine(existing.coordinates, route.coordinates))) {
      continue;
    }
    usedSectors.add(sector);
    kept.push(route);
    if (kept.length >= limit) {
      return kept;
    }
  }
  for (const route of ranked) {
    if (kept.includes(route) || kept.some((existing) => sameCourseLine(existing.coordinates, route.coordinates))) {
      continue;
    }
    kept.push(route);
    if (kept.length >= limit) {
      break;
    }
  }
  return kept;
}

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
  easyKm: number;
  minorKm: number;
  uturnCount: number;
  clockwiseDeg: number;
  overlapRatio: number;
  junctionCount: number;
  roadGapKm: number | null;
  score: number;
  scoreParts: CourseScoreParts;
};

export type CourseProposalSet = {
  courses: BuiltRoute[];
  notice?: string;
};

async function fetchJson(
  url: string,
  timeoutMs: number,
  message: string,
  init?: RequestInit,
  retryable = false,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal == null ? timeout : AbortSignal.any([timeout, signal]);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
      signal: combined,
    });
    if (!response.ok) {
      throw new CourseRouteError(message, retryable);
    }
    return await response.json();
  } catch (error) {
    if (signal?.aborted || error instanceof SearchStopped) {
      throw new SearchStopped();
    }
    if (error instanceof CourseRouteError) {
      throw error;
    }
    throw new CourseRouteError(message, retryable);
  }
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
  const radiusKm = (loopKm / (2 * Math.PI)) * 2.4;
  const latPad = radiusKm / 111;
  const lonPad = radiusKm / (111 * Math.max(0.2, Math.cos((start.lat * Math.PI) / 180)));
  return {
    south: start.lat - latPad,
    north: start.lat + latPad,
    west: start.lon - lonPad,
    east: start.lon + lonPad,
  };
}

async function loadMapContext(start: LatLon, loopKm: number, signal?: AbortSignal) {
  const box = searchBounds(start, loopKm);
  const query = `[out:json][timeout:40];
(
  way["highway"~"^(trunk|primary|secondary|tertiary)(_link)?$"](${box.south},${box.west},${box.north},${box.east});
  way["highway"~"^(unclassified|residential|living_street|cycleway|path|footway|pedestrian|track|service)$"](${box.south},${box.west},${box.north},${box.east});
  node["highway"="traffic_signals"](${box.south},${box.west},${box.north},${box.east});
  way["leisure"="park"](${box.south},${box.west},${box.north},${box.east});
  way["landuse"="recreation_ground"](${box.south},${box.west},${box.north},${box.east});
  relation["leisure"="park"](${box.south},${box.west},${box.north},${box.east});
  relation["landuse"="recreation_ground"](${box.south},${box.west},${box.north},${box.east});
  way["waterway"~"river|stream|canal"](${box.south},${box.west},${box.north},${box.east});
);
out geom;`;
  const payload = await fetchJson(OVERPASS_URL, 50_000, MAP_SERVICE_MESSAGE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  }, true, signal);
  return parseOverpass(payload);
}

async function loadElevation(coordinates: LatLon[], signal?: AbortSignal): Promise<{ ascentM: number; descentM: number }> {
  const spacing = Math.max(200, (routeLengthKm(coordinates) * 1000) / 70);
  const samples = sampleRoute(coordinates, spacing, 80);
  const url = new URL(ELEVATION_URL);
  url.searchParams.set("latitude", samples.map((point) => point.lat.toFixed(5)).join(","));
  url.searchParams.set("longitude", samples.map((point) => point.lon.toFixed(5)).join(","));
  const payload = await fetchJson(url.toString(), 20_000, MAP_SERVICE_MESSAGE, undefined, true, signal);
  const heights = parseElevations(payload);
  if (heights.length === 0) {
    throw new CourseRouteError(MAP_SERVICE_MESSAGE, true);
  }
  return elevationChange(heights);
}

async function proposeCoursesOnce(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number) => void,
  signal?: AbortSignal,
): Promise<CourseProposalSet> {
  onProgress?.(0, 1, 0);
  const mapContext = await loadMapContext(start, distanceKm, signal);
  const classified = mapContext.roads.map((road) => ({
    coordinates: road.coordinates,
    level: highwaySearchLevel(road.highway),
    easy: isEasyRoad(road.highway, road.coordinates, mapContext.parks, mapContext.waters, mapContext.parkHoles),
  }));
  type PlannedLoop = ExploredLoop & { roadGapKm: number | null };
  const pool: PlannedLoop[] = [];
  let distanceMiss: PlannedLoop | null = null;
  let overlapMiss: PlannedLoop | null = null;
  const roadGap = { km: 0 as number | null };
  const presentLoop = (loop: ExploredLoop): PlannedLoop => {
    const coordinates = straightenShortSpikes(loop.coordinates);
    return {
      ...loop,
      coordinates,
      distanceKm: routeLengthKm(coordinates),
      uturnCount: countUturns(coordinates),
      roadGapKm: roadGap.km,
    };
  };
  const note = (raw: ExploredLoop) => {
    const loop = presentLoop(raw);
    const ratio = overlapRatio(loop.coordinates);
    if (acceptCourseDistance(loop.distanceKm, distanceKm)) {
      if (ratio > OVERLAP_REJECT_RATIO) {
        const current = overlapMiss == null ? Number.POSITIVE_INFINITY : overlapRatio(overlapMiss.coordinates);
        const currentGap = overlapMiss == null ? Number.POSITIVE_INFINITY : Math.abs(overlapMiss.distanceKm - distanceKm);
        if (ratio < current || (ratio === current && Math.abs(loop.distanceKm - distanceKm) < currentGap)) {
          overlapMiss = loop;
        }
      }
      return;
    }
    const gap = Math.abs(loop.distanceKm - distanceKm);
    if (distanceMiss == null || gap < Math.abs(distanceMiss.distanceKm - distanceKm)) {
      distanceMiss = loop;
    }
  };
  let previousCount = -1;
  const approach = classified.map((road) => ({ coordinates: road.coordinates, easy: road.easy }));
  const inPark = pointInPark(start, mapContext.parks, mapContext.parkHoles);
  const beside = courseRoadStarts(
    start,
    mapContext.roads,
    mapContext.waters,
    undefined,
    courseRoadStartLimit(distanceKm),
  );
  const onCourseRoad = (beside[0]?.meters ?? Number.POSITIVE_INFINITY) <= 45;
  const narrow = facesNarrowRoad(start, mapContext.roads, mapContext.waters);
  const origins =
    (inPark || narrow) && !onCourseRoad && beside.length > 0
      ? beside.map((road) => ({ point: road.point, meters: road.meters as number | null }))
      : [{ point: start, meters: (inPark || narrow) && !onCourseRoad ? null : 0 }];
  let loopWays = approach.filter((road) => road.easy);
  for (let level = 0; level <= HIGHWAY_SEARCH_LEVEL_MAX; level += 1) {
    const ways = classified
      .filter((road) => road.easy || road.level <= level)
      .map((road) => ({ coordinates: road.coordinates, easy: road.easy }));
    if (ways.length === 0 || ways.length === previousCount) {
      continue;
    }
    previousCount = ways.length;
    loopWays = ways;
    onProgress?.(level, HIGHWAY_SEARCH_LEVEL_MAX + 1, pool.length);
    for (const origin of origins) {
      roadGap.km = origin.meters == null ? null : origin.meters / 1000;
      const courseStart = origin.point;
      const blocked: number[] = [];
      const offStart = nearestWayMeters(courseStart, ways) > 45;
      if (offStart) {
        const stemmed = await coursesWithAccessStem(courseStart, distanceKm, approach, COURSE_CANDIDATE_LIMIT, note, signal, ways);
        const prepared = stemmed.map(presentLoop);
        for (const loop of prepared) {
          note(loop);
          if (!acceptCourseDistance(loop.distanceKm, distanceKm) || overlapRatio(loop.coordinates) > OVERLAP_REJECT_RATIO) {
            continue;
          }
          const sector = loopTravelSector(courseStart, loop.coordinates);
          const crowded = pool.filter((existing) => loopTravelSector(courseStart, existing.coordinates) === sector).length >= 2;
          if (crowded || pool.some((existing) => sameCourseLine(existing.coordinates, loop.coordinates))) {
            continue;
          }
          pool.push(loop);
        }
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (signal?.aborted) {
          throw new SearchStopped();
        }
        const returned = await returnToStartLoops(courseStart, distanceKm, ways, COURSE_CANDIDATE_LIMIT, blocked, null, note, signal);
        const found = returned.length > 0
          ? returned
          : attempt === 0
            ? await exploreClockwiseLoops(
                courseStart,
                distanceKm,
                ways,
                COURSE_CANDIDATE_LIMIT,
                Math.random,
                level === 0 ? 28 : Math.max(4, 16 - level * 2),
                level === 0 ? 3 : 4,
                note,
                signal,
              )
            : [];
        const foundLoops = found.map(presentLoop);
        for (const loop of foundLoops) {
          note(loop);
        }
        const inBand = foundLoops.filter((loop) => acceptCourseDistance(loop.distanceKm, distanceKm));
        const added: typeof inBand = [];
        for (const loop of inBand) {
          if (overlapRatio(loop.coordinates) > OVERLAP_REJECT_RATIO) {
            continue;
          }
          const sector = loopTravelSector(courseStart, loop.coordinates);
          const crowded = pool.filter((existing) => loopTravelSector(courseStart, existing.coordinates) === sector).length >= 2;
          if (crowded || pool.some((existing) => sameCourseLine(existing.coordinates, loop.coordinates))) {
            continue;
          }
          pool.push(loop);
          added.push(loop);
        }
        if (added.length === 0 || headingsCoverReverse(blocked.concat(added.flatMap((loop) => departureBearings(courseStart, loop.coordinates))))) {
          break;
        }
        for (const loop of added) {
          blocked.push(...departureBearings(courseStart, loop.coordinates));
        }
      }
    }
    if (pool.length > 0) {
      break;
    }
  }
  const covered = () => new Set(pool.map((loop) => loopTravelSector(start, loop.coordinates)));
  const extraLimit = courseStemSearchLimit(distanceKm);
  if (origins.length === 1 && extraLimit > 0 && covered().size < COURSE_PROPOSAL_LIMIT) {
    const origin = origins[0];
    roadGap.km = origin.meters == null ? null : origin.meters / 1000;
    const extras = (await coursesWithAccessStem(origin.point, distanceKm, approach, extraLimit, note, signal, loopWays)).map(presentLoop);
    for (const extra of extras) {
      note(extra);
      if (!acceptCourseDistance(extra.distanceKm, distanceKm) || overlapRatio(extra.coordinates) > OVERLAP_REJECT_RATIO) {
        continue;
      }
      const got = loopTravelSector(start, extra.coordinates);
      if (covered().has(got) || pool.some((existing) => sameCourseLine(existing.coordinates, extra.coordinates))) {
        continue;
      }
      pool.push(extra);
      if (covered().size >= COURSE_PROPOSAL_LIMIT) {
        break;
      }
    }
  }
  let notice: string | undefined;
  let explored = pool;
  if (explored.length === 0) {
    explored = chooseNearMisses(distanceMiss, overlapMiss);
    if (explored.length > 0) {
      notice = NEAR_COURSE_NOTICE;
    }
  }
  onProgress?.(1, 1, notice ? 0 : explored.length);
  if (explored.length === 0) {
    throw new CourseRouteError("希望の距離に近い周回を作れませんでした。距離を変えて、もう一度試してください");
  }
  const junctions = majorIntersections(mapContext.majors);
  const distinct = preferSpreadDirections(
    start,
    explored.map((loop) => {
      const actualKm = loop.distanceKm;
      const majorKm = lengthNearLinesKm(loop.coordinates, mapContext.majors, MAJOR_ROAD_NEAR_METERS);
      const overlap = overlapRatio(loop.coordinates);
      const straight = straightStats(loop.coordinates);
      const signalCount = 0;
      const featureKm = featureLengthKm(loop.coordinates, mapContext.parks, mapContext.waters);
      const junctionCount = countNearRoute(loop.coordinates, junctions, 25);
      const totalMeters = Math.max(actualKm * 1000, 1);
      const scoreParts = courseScoreParts({
        distanceKm: actualKm,
        targetKm: distanceKm,
        easyRatio: loop.easyMeters / totalMeters,
        minorRatio: loop.minorMeters / totalMeters,
        turnCount: turnCount(loop.coordinates),
        signalCount,
        junctionCount,
        overlapRatio: overlap,
        meanLegMeters: straight.meanLegMeters,
        longestLegMeters: straight.longestLegMeters,
        shortLegCount: straight.shortLegCount,
        clockwiseDeg: loop.clockwiseDeg,
        uturnCount: loop.uturnCount,
      });
      return {
        distanceKm: actualKm,
        coordinates: loop.coordinates,
        turnCount: turnCount(loop.coordinates),
        signalCount,
        featureKm,
        ascentM: 0,
        descentM: 0,
        majorKm,
        easyKm: loop.easyMeters / 1000,
        minorKm: loop.minorMeters / 1000,
        uturnCount: loop.uturnCount,
        clockwiseDeg: loop.clockwiseDeg,
        overlapRatio: overlap,
        junctionCount,
        roadGapKm: loop.roadGapKm,
        score: scoreParts.total,
        scoreParts,
      };
    }),
    COURSE_PROPOSAL_LIMIT,
  );
  const courses = await mapPool(distinct, 2, async (route) => {
    try {
      const relief = await loadElevation(route.coordinates, signal);
      return { ...route, ...relief };
    } catch (error) {
      if (error instanceof CourseRouteError && error.retryable) {
        return route;
      }
      throw error;
    }
  });
  return { courses, notice };
}

export async function proposeCourses(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number) => void,
  signal?: AbortSignal,
): Promise<CourseProposalSet> {
  const started = Date.now();
  try {
    onProgress?.(0, 0, 0);
    return await proposeCoursesOnce(start, distanceKm, onProgress, signal);
  } catch (error) {
    if (error instanceof SearchStopped || signal?.aborted) {
      throw new SearchStopped();
    }
    if (!(error instanceof CourseRouteError) || !shouldRetryMapService(Date.now() - started, error.retryable)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, MAP_RETRY_PAUSE_MS));
    if (signal?.aborted) {
      throw new SearchStopped();
    }
    onProgress?.(0, 0, 0);
    return await proposeCoursesOnce(start, distanceKm, onProgress, signal);
  }
}
