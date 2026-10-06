import {
  acceptCourseDistance,
  chooseNearMisses,
  COURSE_PROPOSAL_LIMIT,
  cleanCourseGeometry,
  countCrossedSignals,
  countNearRoute,
  countUturns,
  courseBoundsRadiusScale,
  courseCandidateLimit,
  courseExpansionLimit,
  courseKeepLimit,
  courseNearStartFullBranchMeters,
  courseScoreParts,
  elevationChange,
  featureLengthKm,
  CONNECTOR_FETCH_METERS,
  HIGHWAY_SEARCH_LEVEL_MAX,
  isConnectorRoad,
  isEasyRoad,
  isLargeFetchHighway,
  isNearFetchHighway,
  isPreferRunRoad,
  wayHitsStartCircle,
  courseStemSearchLimit,
  COURSE_EMPTY_HINT_MESSAGE,
  COURSE_NO_START_ROAD_HINT_MESSAGE,
  COURSE_NO_START_ROAD_MESSAGE,
  loopCoversBbox,
  nearbyEasyRoadHints,
  nearestStartableRoad,
  lengthNearLinesKm,
  MAJOR_ROAD_NEAR_METERS,
  majorIntersections,
  MAP_SERVICE_MESSAGE,
  MINOR_REJECT_RATIO,
  NEAR_COURSE_NOTICE,
  overlapRatio,
  OVERLAP_REJECT_RATIO,
  parseElevations,
  parseOverpass,
  routeLengthKm,
  sameCourseLine,
  sampleRoute,
  SIGNAL_NEAR_METERS,
  shouldRetryMapService,
  straightStats,
  turnCount,
  wayAlongParkOrWater,
  type CourseScoreParts,
  type CourseSearchStage,
  type LatLon,
} from "../courses";
import {
  coursesWithAccessStem,
  departureBearings,
  exploreClockwiseLoops,
  featurePreferSectors,
  loopTravelSector,
  nearestWayMeters,
  returnToStartLoops,
  SearchStopped,
  type ExploredLoop,
} from "../course-network";

/** 診断用。皇居外周のおおよそ範囲。 */
const PALACE_DIAG_BOX = { minLat: 35.677, maxLat: 35.691, minLon: 139.748, maxLon: 139.761 };

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
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
  score: number;
  scoreParts: CourseScoreParts;
};

export type CourseProposalSet = {
  courses: BuiltRoute[];
  notice?: string;
  /** 起点移動の案内用。周辺の走りやすい道。 */
  hintRoads?: LatLon[][];
};

export type CoursePoolDiagEntry = {
  distanceKm: number;
  sector: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  coversPalace: boolean;
  featureKm: number;
  status: "pool" | "distance" | "overlap" | "minor" | "crowded" | "same";
};

export type CourseProposalDiag = CourseProposalSet & {
  diagnose: {
    alongFeatureWays: number;
    featureSectors: number[];
    considered: CoursePoolDiagEntry[];
    poolCount: number;
    palaceInPool: number;
    palaceInSelected: number;
  };
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
  const radiusKm = (loopKm / (2 * Math.PI)) * courseBoundsRadiusScale(loopKm);
  const latPad = radiusKm / 111;
  const lonPad = radiusKm / (111 * Math.max(0.2, Math.cos((start.lat * Math.PI) / 180)));
  return {
    south: start.lat - latPad,
    north: start.lat + latPad,
    west: start.lon - lonPad,
    east: start.lon + lonPad,
  };
}

/**
 * Overpass へ問い合わせる。
 * @param query Overpass QL
 * @param signal 中止信号
 * @param retryAlternate true のとき別エンドポイントへ1回まで付け替える（主要道用）。近隣・公園は false
 * @returns JSON 応答
 */
async function fetchOverpass(query: string, signal?: AbortSignal, retryAlternate = true): Promise<unknown> {
  let lastError: unknown = null;
  const urls = retryAlternate ? OVERPASS_URLS : OVERPASS_URLS.slice(0, 1);
  for (const url of urls) {
    if (signal?.aborted) {
      throw new SearchStopped();
    }
    try {
      return await fetchJson(url, 55_000, MAP_SERVICE_MESSAGE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      }, true, signal);
    } catch (error) {
      lastError = error;
      if (error instanceof SearchStopped || signal?.aborted) {
        throw error;
      }
    }
  }
  throw lastError instanceof CourseRouteError
    ? lastError
    : new CourseRouteError(MAP_SERVICE_MESSAGE, true);
}

function throwIfStopped(reason: unknown, signal?: AbortSignal): never | void {
  if (reason instanceof SearchStopped || signal?.aborted) {
    throw reason instanceof SearchStopped ? reason : new SearchStopped();
  }
}

async function loadMapContext(
  start: LatLon,
  loopKm: number,
  signal?: AbortSignal,
  onProgress?: (finished: number, total: number, passed: number, stage?: CourseSearchStage) => void,
) {
  const box = searchBounds(start, loopKm);
  const around = `around:${CONNECTOR_FETCH_METERS},${start.lat.toFixed(6)},${start.lon.toFixed(6)}`;
  // ① 主要道＋信号（必須）→ ② 近隣の接続道路と ③ 公園・水域を並列（どちらも失敗しても続行）
  const majorQuery = `[out:json][timeout:40];
(
  way["highway"~"^(trunk|primary|secondary|tertiary|cycleway|crossing)(_link)?$"](${box.south},${box.west},${box.north},${box.east});
  node["highway"="traffic_signals"](${box.south},${box.west},${box.north},${box.east});
  node["crossing"="traffic_signals"](${box.south},${box.west},${box.north},${box.east});
  node["highway"="crossing"](${box.south},${box.west},${box.north},${box.east});
);
out geom;`;
  const nearQuery = `[out:json][timeout:30];
(
  way["highway"~"^(unclassified|residential|living_street|service|path|footway|pedestrian)(_link)?$"](${around});
);
out geom;`;
  const featureQuery = `[out:json][timeout:30];
(
  way["leisure"="park"](${box.south},${box.west},${box.north},${box.east});
  way["landuse"="recreation_ground"](${box.south},${box.west},${box.north},${box.east});
  relation["leisure"="park"](${box.south},${box.west},${box.north},${box.east});
  relation["landuse"="recreation_ground"](${box.south},${box.west},${box.north},${box.east});
  way["waterway"~"river|stream|canal|riverbank"](${box.south},${box.west},${box.north},${box.east});
  way["natural"="water"](${box.south},${box.west},${box.north},${box.east});
  way["water"="moat"](${box.south},${box.west},${box.north},${box.east});
  relation["natural"="water"](${box.south},${box.west},${box.north},${box.east});
  relation["water"="moat"](${box.south},${box.west},${box.north},${box.east});
);
out geom;`;

  onProgress?.(0, 1, 0, "major");
  const major = parseOverpass(await fetchOverpass(majorQuery, signal));
  const majorRoads = major.roads.filter((road) => isLargeFetchHighway(road.highway));

  onProgress?.(0, 1, 0, "near");
  // 近隣・公園／河川敷は重要度が低いので、失敗しても別サーバへ付け替えない
  const nearFetch = fetchOverpass(nearQuery, signal, false);
  const featureFetch = fetchOverpass(featureQuery, signal, false);
  // 並列中は近隣の文言から始め、近隣が先に終われば公園・河川敷の文言へ切り替える
  void nearFetch.then(
    () => onProgress?.(0, 1, 0, "features"),
    () => onProgress?.(0, 1, 0, "features"),
  );
  const [nearResult, featureResult] = await Promise.allSettled([nearFetch, featureFetch]);

  let nearRoads: typeof major.roads = [];
  if (nearResult.status === "fulfilled") {
    const near = parseOverpass(nearResult.value);
    nearRoads = near.roads.filter(
      (road) => isNearFetchHighway(road.highway) && wayHitsStartCircle(road.coordinates, start, CONNECTOR_FETCH_METERS),
    );
  } else {
    throwIfStopped(nearResult.reason, signal);
  }

  let parks = major.parks;
  let parkHoles = major.parkHoles;
  let waters = major.waters;
  if (featureResult.status === "fulfilled") {
    const features = parseOverpass(featureResult.value);
    parks = features.parks;
    parkHoles = features.parkHoles;
    waters = features.waters;
  } else {
    throwIfStopped(featureResult.reason, signal);
    parks = [];
    parkHoles = [];
    waters = [];
  }

  return {
    signals: major.signals,
    parks,
    parkHoles,
    waters,
    majors: major.majors,
    roads: [...majorRoads, ...nearRoads],
  };
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
  onProgress?: (finished: number, total: number, passed: number, stage?: CourseSearchStage) => void,
  signal?: AbortSignal,
  diagnose = false,
): Promise<CourseProposalSet | CourseProposalDiag> {
  const keepLimit = courseKeepLimit(distanceKm);
  const candidateLimit = courseCandidateLimit(distanceKm);
  const expansionLimit = courseExpansionLimit(distanceKm);
  const nearStartMeters = courseNearStartFullBranchMeters(distanceKm);

  const mapContext = await loadMapContext(start, distanceKm, signal, onProgress);
  onProgress?.(0, HIGHWAY_SEARCH_LEVEL_MAX + 1, 0, "explore");
  const classified = mapContext.roads.flatMap((road) => {
    const easy = isEasyRoad(
      road.tags,
      road.coordinates,
      mapContext.parks,
      mapContext.waters,
      mapContext.parkHoles,
    );
    const alongFeature = wayAlongParkOrWater(road.coordinates, mapContext.parks, mapContext.waters);
    const preferRun = easy && isPreferRunRoad(road.tags);
    return [
      {
        coordinates: road.coordinates,
        highway: road.highway,
        tags: road.tags,
        easy,
        preferRun,
        sidewalk: preferRun,
        alongFeature,
        connector: !easy && isConnectorRoad(road.tags, road.coordinates),
      },
    ];
  });
  type PlannedLoop = ExploredLoop;
  const pool: PlannedLoop[] = [];
  const poolDone = () => pool.length >= keepLimit;
  const considered: CoursePoolDiagEntry[] = [];
  let distanceMiss: PlannedLoop | null = null;
  let overlapMiss: PlannedLoop | null = null;
  const presentLoop = (loop: ExploredLoop): PlannedLoop => {
    const coordinates = cleanCourseGeometry(loop.coordinates);
    return {
      ...loop,
      coordinates,
      distanceKm: routeLengthKm(coordinates),
      uturnCount: countUturns(coordinates),
    };
  };
  const minorRatioOf = (loop: { minorMeters: number; distanceKm: number }) =>
    loop.minorMeters / Math.max(loop.distanceKm * 1000, 1);
  const bboxOf = (coordinates: LatLon[]) => {
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const point of coordinates) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    }
    return { minLat, maxLat, minLon, maxLon };
  };
  const recordDiag = (loop: PlannedLoop, courseStart: LatLon, status: CoursePoolDiagEntry["status"]) => {
    if (!diagnose) {
      return;
    }
    const box = bboxOf(loop.coordinates);
    considered.push({
      distanceKm: loop.distanceKm,
      sector: loopTravelSector(courseStart, loop.coordinates),
      ...box,
      coversPalace: loopCoversBbox(loop.coordinates, PALACE_DIAG_BOX),
      featureKm: featureLengthKm(loop.coordinates, mapContext.parks, mapContext.waters),
      status,
    });
  };
  const note = (raw: ExploredLoop) => {
    const loop = presentLoop(raw);
    const ratio = overlapRatio(loop.coordinates);
    if (acceptCourseDistance(loop.distanceKm, distanceKm)) {
      if (ratio > OVERLAP_REJECT_RATIO || minorRatioOf(loop) > MINOR_REJECT_RATIO) {
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
  const tryAddToPool = (loop: PlannedLoop, courseStart: LatLon): boolean => {
    if (!acceptCourseDistance(loop.distanceKm, distanceKm)) {
      recordDiag(loop, courseStart, "distance");
      return false;
    }
    if (overlapRatio(loop.coordinates) > OVERLAP_REJECT_RATIO) {
      recordDiag(loop, courseStart, "overlap");
      return false;
    }
    if (minorRatioOf(loop) > MINOR_REJECT_RATIO) {
      recordDiag(loop, courseStart, "minor");
      return false;
    }
    const sector = loopTravelSector(courseStart, loop.coordinates);
    const crowded = pool.filter((existing) => loopTravelSector(courseStart, existing.coordinates) === sector).length >= 2;
    if (crowded) {
      recordDiag(loop, courseStart, "crowded");
      return false;
    }
    if (pool.some((existing) => sameCourseLine(existing.coordinates, loop.coordinates))) {
      recordDiag(loop, courseStart, "same");
      return false;
    }
    pool.push(loop);
    recordDiag(loop, courseStart, "pool");
    return true;
  };
  let previousCount = -1;
  const approach = classified
    .filter((road) => road.easy || road.connector)
    .map((road) => ({
      coordinates: road.coordinates,
      easy: road.easy,
      preferRun: road.preferRun,
      sidewalk: road.sidewalk,
      alongFeature: road.alongFeature,
    }));
  const hintRoads = () => nearbyEasyRoadHints(start, classified);
  const snapped = nearestStartableRoad(start, classified);
  if (snapped == null) {
    const hints = hintRoads();
    return {
      courses: [],
      notice: hints.length > 0 ? COURSE_NO_START_ROAD_HINT_MESSAGE : COURSE_NO_START_ROAD_MESSAGE,
      hintRoads: hints,
    };
  }
  const origins = [{ point: snapped.point }];
  const featureSectors = featurePreferSectors(start, distanceKm, mapContext.parks, mapContext.waters, 2);
  let loopWays = approach.filter((road) => road.easy);
  for (let level = 0; level <= HIGHWAY_SEARCH_LEVEL_MAX; level += 1) {
    const ways = classified
      .filter((road) => road.easy || (level >= 1 && road.connector))
      .map((road) => ({
        coordinates: road.coordinates,
        easy: road.easy,
        preferRun: road.preferRun,
        sidewalk: road.sidewalk,
        alongFeature: road.alongFeature,
      }));
    if (ways.length === 0 || ways.length === previousCount) {
      continue;
    }
    previousCount = ways.length;
    loopWays = ways;
    onProgress?.(level, HIGHWAY_SEARCH_LEVEL_MAX + 1, pool.length, "explore");
    for (const origin of origins) {
      if (poolDone()) {
        break;
      }
      const courseStart = origin.point;
      const blocked: number[] = [];
      const offStart = nearestWayMeters(courseStart, ways) > 45;
      if (offStart) {
        const stemmed = await coursesWithAccessStem(courseStart, distanceKm, approach, candidateLimit, note, signal, ways);
        const prepared = stemmed.map(presentLoop);
        for (const loop of prepared) {
          note(loop);
          tryAddToPool(loop, courseStart);
          if (poolDone()) {
            break;
          }
        }
      }
      for (let attempt = 0; attempt < 2 && !poolDone(); attempt += 1) {
        if (signal?.aborted) {
          throw new SearchStopped();
        }
        const found: ExploredLoop[] = [];
        // 公園・水域沿いは Dijkstra 内のごく弱いコスト優遇のみ（専用網の先回り探索はしない）
        const returned = await returnToStartLoops(
          courseStart,
          distanceKm,
          ways,
          candidateLimit,
          blocked,
          null,
          note,
          signal,
        );
        for (const loop of returned) {
          found.push(loop);
        }
        const explored =
          found.length > 0
            ? found
            : attempt === 0
              ? await exploreClockwiseLoops(
                  courseStart,
                  distanceKm,
                  ways,
                  candidateLimit,
                  Math.random,
                  level === 0 ? 36 : 52,
                  level === 0 ? 3 : 4,
                  note,
                  signal,
                  expansionLimit,
                  nearStartMeters,
                )
              : [];
        const foundLoops = explored.map(presentLoop);
        for (const loop of foundLoops) {
          note(loop);
        }
        const added: PlannedLoop[] = [];
        for (const loop of foundLoops) {
          if (tryAddToPool(loop, courseStart)) {
            added.push(loop);
          }
          if (poolDone()) {
            break;
          }
        }
        if (
          poolDone() ||
          added.length === 0 ||
          headingsCoverReverse(blocked.concat(added.flatMap((loop) => departureBearings(courseStart, loop.coordinates))))
        ) {
          break;
        }
        for (const loop of added) {
          blocked.push(...departureBearings(courseStart, loop.coordinates));
        }
      }
    }
    // 合格が打ち切り件数に達したら、接続道路を足す巡も残りの探索もしない
    if (poolDone()) {
      break;
    }
  }
  const covered = () => new Set(pool.map((loop) => loopTravelSector(start, loop.coordinates)));
  const extraLimit = courseStemSearchLimit(distanceKm);
  if (origins.length === 1 && extraLimit > 0 && !poolDone() && covered().size < COURSE_PROPOSAL_LIMIT) {
    const origin = origins[0];
    const extras = (await coursesWithAccessStem(origin.point, distanceKm, approach, extraLimit, note, signal, loopWays)).map(presentLoop);
    for (const extra of extras) {
      note(extra);
      tryAddToPool(extra, origin.point);
      if (poolDone() || covered().size >= COURSE_PROPOSAL_LIMIT) {
        break;
      }
    }
  }
  let notice: string | undefined;
  let explored = pool;
  if (explored.length === 0) {
    explored = chooseNearMisses<PlannedLoop>(distanceMiss, overlapMiss);
    if (explored.length > 0) {
      notice = NEAR_COURSE_NOTICE;
    }
  }
  onProgress?.(1, 1, notice ? 0 : explored.length, "explore");
  if (explored.length === 0) {
    const hints = hintRoads();
    return {
      courses: [],
      notice: hints.length > 0 ? COURSE_EMPTY_HINT_MESSAGE : "希望の距離に近い周回を作れませんでした。距離を変えて、もう一度試してください",
      hintRoads: hints,
    };
  }
  const junctions = majorIntersections(mapContext.majors);
  const distinct = preferSpreadDirections(
    start,
    explored.map((loop) => {
      const actualKm = loop.distanceKm;
      const majorKm = lengthNearLinesKm(loop.coordinates, mapContext.majors, MAJOR_ROAD_NEAR_METERS);
      const overlap = overlapRatio(loop.coordinates);
      const straight = straightStats(loop.coordinates);
      const signalCount = countCrossedSignals(
        loop.coordinates,
        mapContext.signals,
        SIGNAL_NEAR_METERS,
        mapContext.majors,
      );
      const featureKm = featureLengthKm(loop.coordinates, mapContext.parks, mapContext.waters);
      const junctionCount = countNearRoute(loop.coordinates, junctions, 25);
      const corners = turnCount(loop.coordinates);
      const totalMeters = Math.max(actualKm * 1000, 1);
      const scoreParts = courseScoreParts({
        distanceKm: actualKm,
        targetKm: distanceKm,
        easyRatio: loop.easyMeters / totalMeters,
        minorRatio: loop.minorMeters / totalMeters,
        turnCount: corners,
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
        turnCount: corners,
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
  const result: CourseProposalSet = {
    courses,
    notice,
    // 希望距離が作れないときだけ、起点周辺の走りやすい道を案内用に出す
    hintRoads: notice ? hintRoads() : undefined,
  };
  if (!diagnose) {
    return result;
  }
  return {
    ...result,
    diagnose: {
      alongFeatureWays: classified.filter((road) => road.alongFeature).length,
      featureSectors,
      considered,
      poolCount: pool.length,
      palaceInPool: considered.filter((entry) => entry.status === "pool" && entry.coversPalace).length,
      palaceInSelected: courses.filter((course) => loopCoversBbox(course.coordinates, PALACE_DIAG_BOX)).length,
    },
  };
}

async function proposeCoursesInner(
  start: LatLon,
  distanceKm: number,
  onProgress: ((finished: number, total: number, passed: number, stage?: CourseSearchStage) => void) | undefined,
  signal: AbortSignal | undefined,
  diagnose: boolean,
): Promise<CourseProposalSet | CourseProposalDiag> {
  const started = Date.now();
  try {
    onProgress?.(0, 0, 0, "major");
    return await proposeCoursesOnce(start, distanceKm, onProgress, signal, diagnose);
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
    onProgress?.(0, 0, 0, "major");
    return await proposeCoursesOnce(start, distanceKm, onProgress, signal, diagnose);
  }
}

export async function proposeCourses(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number, stage?: CourseSearchStage) => void,
  signal?: AbortSignal,
): Promise<CourseProposalSet> {
  return (await proposeCoursesInner(start, distanceKm, onProgress, signal, false)) as CourseProposalSet;
}

/**
 * 周回提案に加え、プール投入の診断情報を返す（開発用）。
 * @param start 出発点
 * @param distanceKm 指定距離
 * @param onProgress 進捗
 * @param signal 中止信号
 * @returns 提案と診断
 */
export async function proposeCoursesDiagnose(
  start: LatLon,
  distanceKm: number,
  onProgress?: (finished: number, total: number, passed: number, stage?: CourseSearchStage) => void,
  signal?: AbortSignal,
): Promise<CourseProposalDiag> {
  return (await proposeCoursesInner(start, distanceKm, onProgress, signal, true)) as CourseProposalDiag;
}
