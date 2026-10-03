import { distanceKm } from "./nearest-station";

export type LatLon = {
  lat: number;
  lon: number;
};

export const COURSE_DISTANCE_TOLERANCE = 0.2;
export const COURSE_DISTANCE_CAP_KM = 2;
export const COURSE_DIRECTIONS_DEG = [0, 30, 60, 90, 120, 150];
export const SIGNAL_NEAR_METERS = 20;
export const WATER_NEAR_METERS = 40;
export const TURN_MIN_DEG = 45;
export const TURN_MIN_LEG_METERS = 25;
export const LOOP_WAYPOINT_COUNT = 3;
export const MAJOR_ROAD_NEAR_METERS = 30;
export const RETRACE_CORRIDOR_METERS = 25;
export const RETRACE_MIN_ALONG_METERS = 150;
export const RETRACE_JOIN_METERS = 400;
export const RETRACE_LIMIT_METERS = 120;
export const OVERLAP_REJECT_RATIO = 0.1;
export const NEAR_COURSE_NOTICE =
  "希望の距離のコースが作れませんでした。\n指定条件に近かったコースを表示します。\n地図の細い青い線は周辺の走りやすい道です。起点をその近くに動かして、もう一度試してください。";
/** スタートできる道が近くにないときの案内（ヒント線なし）。 */
export const COURSE_NO_START_ROAD_MESSAGE =
  "この地点の近くにスタートできる道がありません。\n公園の広場や山奥など、道から離れた場所ではコースを作れません。地図の起点を道の近くに動かして、もう一度試してください。";
/** スタートできる道が近くにないときの案内（周辺の走りやすい道を細い青実線で示すとき）。 */
export const COURSE_NO_START_ROAD_HINT_MESSAGE =
  "この地点の近くにスタートできる道がありません。\n公園の広場や山奥など、道から離れた場所ではコースを作れません。地図の細い青い線は周辺の走りやすい道です。起点をその近くに動かして、もう一度試してください。";
/** 周回案が1件も無いときの案内。 */
export const COURSE_EMPTY_HINT_MESSAGE =
  "希望の距離に近い周回を作れませんでした。\n地図の細い青い線は周辺の走りやすい道です。起点をその近くに動かすか、距離を変えて、もう一度試してください。";
export const SHORT_LEG_METERS = 120;
export const COURSE_POOL_LIMIT = 10;
export const COURSE_KEEP_LIMIT = 25;
export const COURSE_KEEP_FLOOR = 5;
export const COURSE_ADOPT_FLOOR = 5;
export const COURSE_PROPOSAL_LIMIT = 5;
export const COURSE_DISTANCE_BASE_KM = 5;
export const COURSE_DISTANCE_STEP_KM = 3;
export const COURSE_RELAX_POINTS = 5;
export const COURSE_RELAX_ROUTES = 5;
export const OVERLAP_ZERO_RATIO = 0.1;
/** 細い道の割合がこれ以上なら候補から外す。 */
export const MINOR_REJECT_RATIO = 0.4;
/** 細い道の採点で 0 点になる割合。 */
export const MINOR_ZERO_RATIO = 0.25;
export const TURN_FULL_PER_KM = 1;
export const TURN_ZERO_PER_KM = 3;
export const SIGNAL_ZERO_PER_KM = 5;
export const COURSE_CANDIDATE_LIMIT = 50;
export const COURSE_SHAPE_SCALE = 0.8;
export const SHAPE_SCALE_STEP = 0.02;
export const SHAPE_SCALE_MIN = 0.6;
export const SHAPE_SCALE_MAX = 1.4;
export const SHAPE_ADJUST_LIMIT = 10;
export const SCORE_OVERLAP = 10;
export const SCORE_DISTANCE = 20;
export const SCORE_EASY = 20;
export const SCORE_TURNS = 10;
export const SCORE_STRAIGHT = 10;
export const SCORE_SIGNALS = 10;
export const SCORE_CLOCKWISE = 0;
export const SCORE_UTURN = 0;
export const SCORE_MINOR = 20;
export const SCORE_JUNCTIONS = 0;
/** 走りやすい道同士をつなぐ接続道路の上限（m）。 */
export const CONNECTOR_MAX_METERS = 100;
/** 専用歩道がこの距離以内にある車道は、歩道付き道路とみなして走りやすい道にする。 */
export const PARALLEL_SIDEWALK_METERS = 35;
/** 公園の縁・水域に近い道を周回探索でわずかに優遇する距離（m）。 */
export const FEATURE_EDGE_NEAR_METERS = 80;
const SIGNAL_CROSS_WINDOW_METERS = 35;
const SIGNAL_CLUSTER_METERS = 40;
const SIGNAL_STRAIGHT_CROSS_METERS = 8;
const SIGNAL_ROAD_CROSS_METERS = 18;
export const MAP_SERVICE_RETRY_MS = 60_000;

export function shouldRetryMapService(elapsedMs: number, retryable: boolean): boolean {
  return retryable && elapsedMs >= 0 && elapsedMs < MAP_SERVICE_RETRY_MS;
}

export function courseSearchPercent(finished: number, total: number): number {
  if (!(total > 0) || !(finished >= 0)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((finished / total) * 100)));
}

export function courseSearchLabel(percent: number, passed = 0): string {
  const shown = Math.max(0, Math.min(100, Math.round(percent)));
  const count = Math.max(0, Math.round(passed));
  return `コース検索中です...(${shown}% / 合格ルート: ${count}件)`;
}

export function courseSearchSteps(targetKm: number): number {
  if (!(targetKm > COURSE_DISTANCE_BASE_KM)) {
    return 0;
  }
  return Math.floor((targetKm - COURSE_DISTANCE_BASE_KM) / COURSE_DISTANCE_STEP_KM);
}

export function courseAdoptStrictness(targetKm: number): number {
  return Math.max(COURSE_ADOPT_FLOOR, SCORE_DISTANCE - courseSearchSteps(targetKm) * COURSE_RELAX_POINTS);
}

export function courseDistanceSlack(targetKm: number): number {
  const strictness = courseAdoptStrictness(targetKm);
  return strictness > 0 ? SCORE_DISTANCE / strictness : 1;
}

export function courseKeepLimit(targetKm: number): number {
  return Math.max(COURSE_KEEP_FLOOR, COURSE_KEEP_LIMIT - courseSearchSteps(targetKm) * COURSE_RELAX_ROUTES);
}

/** 起点が1本のとき足す、別方向の探索の上限。 */
export const COURSE_STEM_SEARCH_LIMIT = 8;

/**
 * 別方向を足す探索の回数。長い距離ほど減らす。
 * 5kmまでは8回。3km伸びるごとに2回減らし、17km以上は足さない。
 * @param targetKm 指定距離（km）
 * @returns 追加探索の上限
 */
export function courseStemSearchLimit(targetKm: number): number {
  return Math.max(0, COURSE_STEM_SEARCH_LIMIT - courseSearchSteps(targetKm) * 2);
}

export type CourseScoreParts = {
  distance: number;
  easy: number;
  straight: number;
  turns: number;
  overlap: number;
  signals: number;
  clockwise: number;
  uturn: number;
  minor: number;
  junctions: number;
  total: number;
};

export const MAP_SERVICE_MESSAGE =
  "周回コースを作れませんでした。道路データを取る公開の地図サービスが混み合っていて、一時的に応答できませんでした。\n1〜2分ほど待ってから、もう一度「コースを作る」を押してください。";
export const COURSE_DISTANCE_HARD_TOLERANCE = 0.5;
export const COURSE_DISTANCE_HARD_CAP_KM = 5;

const MAJOR_HIGHWAY = /^(trunk|primary|secondary|tertiary)(_link)?$/;

export type OsmWayTags = {
  highway?: string;
  sidewalk?: string;
  footway?: string;
  foot?: string;
  bicycle?: string;
  route?: string;
  access?: string;
  crossing?: string;
};

export type OsmRoad = {
  coordinates: LatLon[];
  highway: string;
  tags: OsmWayTags;
};

export function isMajorHighway(highway: string): boolean {
  return MAJOR_HIGHWAY.test(highway);
}

/**
 * 歩行者の通行が明確に禁じられている、またはランニングに適さない Way か。
 * @param tags OSM のタグ
 * @returns 除外するとき true
 */
export function isExcludedRoad(tags: OsmWayTags): boolean {
  const highway = tags.highway ?? "";
  if (highway === "motorway" || highway === "motorway_link" || highway === "steps") {
    return true;
  }
  if (tags.foot === "no" || tags.access === "no") {
    return true;
  }
  return false;
}

function tagValue(tags: OsmWayTags, key: keyof OsmWayTags): string {
  const value = tags[key];
  return typeof value === "string" ? value : "";
}

/**
 * 幹線などから独立した専用歩道か。
 * @param tags OSM のタグ
 * @returns `highway=footway` かつ `footway=sidewalk` のとき true
 */
export function isDedicatedSidewalk(tags: OsmWayTags): boolean {
  return tagValue(tags, "highway") === "footway" && tagValue(tags, "footway") === "sidewalk";
}

/**
 * 歩道タグ付きの車道本体か（専用歩道 Way ではない）。
 * @param tags OSM のタグ
 * @returns 歩道付き車道のとき true
 */
export function isTaggedCarriageway(tags: OsmWayTags): boolean {
  const highway = tagValue(tags, "highway");
  if (
    !highway ||
    highway === "footway" ||
    highway === "path" ||
    highway === "pedestrian" ||
    highway === "steps" ||
    highway === "cycleway" ||
    highway === "crossing"
  ) {
    return false;
  }
  const sidewalk = tagValue(tags, "sidewalk");
  return sidewalk === "both" || sidewalk === "left" || sidewalk === "right";
}

/**
 * 独立歩道の隣接により「歩道付き道路」へ昇格できる車道か。
 * @param tags OSM のタグ
 * @returns 昇格候補のとき true
 */
export function canInheritNearbySidewalk(tags: OsmWayTags): boolean {
  if (isExcludedRoad(tags) || isDedicatedSidewalk(tags) || isTaggedCarriageway(tags)) {
    return false;
  }
  const highway = tagValue(tags, "highway");
  if (
    !highway ||
    highway === "footway" ||
    highway === "path" ||
    highway === "pedestrian" ||
    highway === "steps" ||
    highway === "cycleway" ||
    highway === "crossing"
  ) {
    return false;
  }
  return true;
}

/**
 * 座標列の近くに専用歩道があるか。
 * @param coordinates 車道の座標
 * @param sidewalks 専用歩道の線
 * @param maxMeters 近傍とみなす距離
 * @returns サンプルの一定以上が専用歩道に近いとき true
 */
export function hasNearbyDedicatedSidewalk(
  coordinates: LatLon[],
  sidewalks: LatLon[][],
  maxMeters = PARALLEL_SIDEWALK_METERS,
): boolean {
  if (coordinates.length < 2 || sidewalks.length === 0) {
    return false;
  }
  let hits = 0;
  let samples = 0;
  const probe = (point: LatLon) => {
    samples += 1;
    if (nearestOnLines(point, sidewalks, maxMeters)) {
      hits += 1;
    }
  };
  probe(coordinates[0]);
  probe(coordinates[coordinates.length - 1]);
  for (let index = 1; index < coordinates.length; index += 1) {
    probe({
      lat: (coordinates[index - 1].lat + coordinates[index].lat) / 2,
      lon: (coordinates[index - 1].lon + coordinates[index].lon) / 2,
    });
  }
  return samples > 0 && hits / samples >= 0.4;
}

/**
 * タグだけ見て走りやすい道路か（河川敷・公園の幾何は見ない）。
 * 独立歩道（footway=sidewalk）単体は含まない。
 * @param tags OSM のタグ
 * @returns 走りやすい道路のとき true
 */
export function isEasyRoadByTags(tags: OsmWayTags): boolean {
  if (isExcludedRoad(tags) || isDedicatedSidewalk(tags)) {
    return false;
  }
  const highway = tagValue(tags, "highway");
  const footway = tagValue(tags, "footway");
  const sidewalk = tagValue(tags, "sidewalk");
  const foot = tagValue(tags, "foot");
  const bicycle = tagValue(tags, "bicycle");
  const route = tagValue(tags, "route");
  if (sidewalk === "both" || sidewalk === "left" || sidewalk === "right") {
    return true;
  }
  if (foot === "yes" || foot === "designated") {
    return true;
  }
  if (bicycle === "yes" || bicycle === "designated") {
    return true;
  }
  if (route === "running") {
    return true;
  }
  if (highway === "pedestrian") {
    return true;
  }
  if (footway === "crossing") {
    return true;
  }
  return false;
}

/**
 * 独立歩道の隣接も含めて走りやすい道か。
 * @param tags OSM のタグ
 * @param coordinates Way の座標
 * @param parks 公園の外周
 * @param waters 河川の線
 * @param parkHoles 公園の穴
 * @param sidewalkLines 独立歩道の線
 * @returns 走りやすい道路のとき true
 */
export function isEasyRoadConsideringSidewalks(
  tags: OsmWayTags,
  coordinates: LatLon[],
  parks: LatLon[][],
  waters: LatLon[][],
  parkHoles: LatLon[][] = [],
  sidewalkLines: LatLon[][] = [],
): boolean {
  if (isDedicatedSidewalk(tags)) {
    return false;
  }
  if (isEasyRoad(tags, coordinates, parks, waters, parkHoles)) {
    return true;
  }
  return canInheritNearbySidewalk(tags) && hasNearbyDedicatedSidewalk(coordinates, sidewalkLines);
}

const CONNECTOR_HIGHWAY = /^(residential|living_street|unclassified|service|track|path|footway|cycleway|pedestrian)(_link)?$/;

/**
 * 走りやすい道をつなぐ歩行可能な接続道路か。
 * 生活道路などは Way 全体の長さにかかわらず候補にする（長い利用は細い道の点数で下げる）。
 * 幹線の車道本体は接続にも使わない。ごく短い道だけ例外でつなぎに使う。
 * @param tags OSM のタグ
 * @param coordinates Way の座標
 * @returns 接続候補のとき true
 */
export function isConnectorRoad(tags: OsmWayTags, coordinates: LatLon[]): boolean {
  // 独立歩道はルートに入れない（隣接車道を走りやすい道へ昇格させる材料にだけ使う）
  if (isExcludedRoad(tags) || isEasyRoadByTags(tags) || isTaggedCarriageway(tags) || isDedicatedSidewalk(tags)) {
    return false;
  }
  const highway = tagValue(tags, "highway");
  if (!highway) {
    return false;
  }
  if (CONNECTOR_HIGHWAY.test(highway)) {
    return true;
  }
  // 歩道タグの無い幹線は原則使わないが、横断などのごく短い Way だけつなぎに許す
  return routeLengthKm(coordinates) * 1000 <= CONNECTOR_MAX_METERS + 1e-6;
}

const LOWER_STEPS: RegExp[] = [
  /^(unclassified)(_link)?$/,
  /^(residential)(_link)?$/,
  /^(living_street)(_link)?$/,
  /^(cycleway)(_link)?$/,
  /^(path|footway|pedestrian)(_link)?$/,
  /^(track|service)(_link)?$/,
];

/**
 * 道の段階。0 は走りやすい道。1 以降は従来の highway 段階（後方互換のテスト用）。
 * @param highway 道路種別（後方互換のテスト用）
 * @returns 段階番号
 */
export function highwaySearchLevel(highway: string): number {
  if (isMajorHighway(highway)) {
    return 0;
  }
  const index = LOWER_STEPS.findIndex((pattern) => pattern.test(highway));
  return index < 0 ? LOWER_STEPS.length : index + 1;
}

/** 探索の段階。0=走りやすい道のみ、1=接続道路を足す。 */
export const HIGHWAY_SEARCH_LEVEL_MAX = 1;

export function acceptCourseDistance(actualKm: number, targetKm: number): boolean {
  if (!(actualKm > 0) || !(targetKm > 0)) {
    return false;
  }
  return Math.abs(actualKm - targetKm) <= targetKm * COURSE_DISTANCE_TOLERANCE;
}

/** 合格が無いときに出す、距離ちがい1件と重複ちがい1件。同じ線は1本にまとめる。 */
export function chooseNearMisses<T extends { coordinates: LatLon[] }>(
  distanceMiss: T | null,
  overlapMiss: T | null,
): T[] {
  const picked: T[] = [];
  if (distanceMiss != null) {
    picked.push(distanceMiss);
  }
  if (
    overlapMiss != null &&
    !picked.some((item) => sameCourseLine(item.coordinates, overlapMiss.coordinates))
  ) {
    picked.push(overlapMiss);
  }
  return picked;
}

export function keepCourseDistance(actualKm: number, targetKm: number): boolean {
  return acceptCourseDistance(actualKm, targetKm);
}

export function destinationPoint(start: LatLon, bearingDeg: number, distanceKmValue: number): LatLon {
  const earthKm = 6371;
  const angular = distanceKmValue / earthKm;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lon1 = (start.lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

export function circleWaypoints(
  start: LatLon,
  distanceKmValue: number,
  angleOffsetDeg: number,
  radiusScale = 1,
  count = 5,
): LatLon[] {
  const radiusKm = (distanceKmValue / (2 * Math.PI)) * radiusScale;
  const points: LatLon[] = [];
  for (let index = 1; index <= count; index += 1) {
    const bearing = angleOffsetDeg + (360 / count) * index;
    points.push(destinationPoint(start, bearing, radiusKm));
  }
  return points;
}

export function routeLengthKm(coordinates: LatLon[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceKm(
      coordinates[index - 1].lat,
      coordinates[index - 1].lon,
      coordinates[index].lat,
      coordinates[index].lon,
    );
  }
  return total;
}

function bearingDeg(from: LatLon, to: LatLon): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function turnDelta(fromDeg: number, toDeg: number): number {
  const delta = Math.abs(toDeg - fromDeg) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function signedTurnDeg(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

export type StraightStats = {
  meanLegMeters: number;
  longestLegMeters: number;
  shortLegCount: number;
};

export function straightStats(
  coordinates: LatLon[],
  minTurnDeg = TURN_MIN_DEG,
  minLegMeters = TURN_MIN_LEG_METERS,
  shortLegMeters = SHORT_LEG_METERS,
): StraightStats {
  const legs: number[] = [];
  let legMeters = 0;
  let heading: number | null = null;
  for (let index = 1; index < coordinates.length; index += 1) {
    const step =
      distanceKm(
        coordinates[index - 1].lat,
        coordinates[index - 1].lon,
        coordinates[index].lat,
        coordinates[index].lon,
      ) * 1000;
    if (step < 1) {
      continue;
    }
    const next = bearingDeg(coordinates[index - 1], coordinates[index]);
    if (heading != null && step >= minLegMeters && turnDelta(heading, next) >= minTurnDeg && legMeters > 0) {
      legs.push(legMeters);
      legMeters = 0;
    }
    legMeters += step;
    if (step >= minLegMeters) {
      heading = next;
    }
  }
  if (legMeters > 0) {
    legs.push(legMeters);
  }
  if (legs.length === 0) {
    return { meanLegMeters: 0, longestLegMeters: 0, shortLegCount: 0 };
  }
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  return {
    meanLegMeters: total / legs.length,
    longestLegMeters: Math.max(...legs),
    shortLegCount: legs.filter((leg) => leg < shortLegMeters).length,
  };
}

export function turnCount(
  coordinates: LatLon[],
  minTurnDeg = TURN_MIN_DEG,
  minLegMeters = TURN_MIN_LEG_METERS,
): number {
  let count = 0;
  let heading: number | null = null;
  let anchor: LatLon | null = null;
  for (const point of coordinates) {
    if (anchor == null) {
      anchor = point;
      continue;
    }
    const legMeters = distanceKm(anchor.lat, anchor.lon, point.lat, point.lon) * 1000;
    if (legMeters < minLegMeters) {
      continue;
    }
    const next = bearingDeg(anchor, point);
    if (heading != null && turnDelta(heading, next) >= minTurnDeg) {
      count += 1;
    }
    heading = next;
    anchor = point;
  }
  return count;
}

export function waypointsAreSpread(start: LatLon, points: LatLon[], loopKm: number): boolean {
  const vias = points.slice(1, -1);
  if (vias.length < 2) {
    return false;
  }
  const radiusM = (loopKm / (2 * Math.PI)) * 1000;
  const minSep = Math.max(200, radiusM * 0.55);
  for (let index = 0; index < vias.length; index += 1) {
    if (distanceKm(start.lat, start.lon, vias[index].lat, vias[index].lon) * 1000 < minSep * 0.35) {
      return false;
    }
    for (let other = index + 1; other < vias.length; other += 1) {
      if (distanceKm(vias[index].lat, vias[index].lon, vias[other].lat, vias[other].lon) * 1000 < minSep) {
        return false;
      }
    }
  }
  return true;
}

export function orderLoopVias(start: LatLon, candidates: LatLon[]): LatLon[] | null {
  const ranked = candidates
    .map((point) => ({
      point,
      bearing: bearingDeg(start, point),
      meters: distanceKm(start.lat, start.lon, point.lat, point.lon) * 1000,
    }))
    .filter((item) => item.meters >= 80)
    .sort((left, right) => left.bearing - right.bearing);
  const kept: typeof ranked = [];
  for (const item of ranked) {
    const previous = kept[kept.length - 1];
    if (previous && item.bearing - previous.bearing < 35) {
      if (item.meters > previous.meters) {
        kept[kept.length - 1] = item;
      }
      continue;
    }
    kept.push(item);
  }
  if (kept.length >= 2) {
    const wrap = kept[0].bearing + 360 - kept[kept.length - 1].bearing;
    if (wrap < 35) {
      if (kept[0].meters >= kept[kept.length - 1].meters) {
        kept.pop();
      } else {
        kept.shift();
      }
    }
  }
  if (kept.length < 2) {
    return null;
  }
  const gaps = kept.map((item, index) => {
    const next = kept[(index + 1) % kept.length];
    return (next.bearing - item.bearing + 360) % 360;
  });
  if (Math.max(...gaps) > 200) {
    return null;
  }
  return kept.map((item) => item.point);
}

export function majorIntersections(lines: LatLon[][], nearMeters = 18): LatLon[] {
  const segments: { line: number; start: LatLon; end: LatLon }[] = [];
  const buckets = new Map<string, number[]>();
  lines.forEach((line, lineIndex) => {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const segmentIndex = segments.length;
      segments.push({ line: lineIndex, start, end });
      const span = distanceKm(start.lat, start.lon, end.lat, end.lon) * 1000;
      const steps = Math.max(1, Math.ceil(span / 40));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const key = gridKey({
          lat: start.lat + (end.lat - start.lat) * t,
          lon: start.lon + (end.lon - start.lon) * t,
        });
        const bucket = buckets.get(key) ?? [];
        if (!bucket.includes(segmentIndex)) {
          bucket.push(segmentIndex);
        }
        buckets.set(key, bucket);
      }
    }
  });
  const found: LatLon[] = [];
  for (const indexes of buckets.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const a = segments[indexes[left]];
        const b = segments[indexes[right]];
        if (a.line === b.line) {
          continue;
        }
        const junction = segmentJunction(a.start, a.end, b.start, b.end, nearMeters);
        if (junction) {
          found.push(junction);
        }
      }
    }
  }
  return dedupePoints(found, 30);
}

export function pickIntersectionVias(start: LatLon, loopKm: number, intersections: LatLon[]): LatLon[][] {
  const radiusM = (loopKm / (2 * Math.PI)) * 1000;
  const sectors: Array<LatLon | null> = new Array(8).fill(null);
  const sectorGap = new Array(8).fill(Number.POSITIVE_INFINITY);
  for (const point of intersections) {
    const meters = distanceKm(start.lat, start.lon, point.lat, point.lon) * 1000;
    if (meters < radiusM * 0.35 || meters > radiusM * 1.45) {
      continue;
    }
    const sector = Math.floor(bearingDeg(start, point) / 45) % 8;
    const gap = Math.abs(meters - radiusM);
    if (gap < sectorGap[sector]) {
      sectorGap[sector] = gap;
      sectors[sector] = point;
    }
  }
  const around = sectors.filter((point): point is LatLon => point != null);
  const sets: LatLon[][] = [];
  const push = (points: LatLon[]) => {
    const ordered = orderLoopVias(start, points);
    if (ordered && ordered.length >= 3 && ordered.length <= 4) {
      sets.push(ordered);
    }
  };
  if (around.length >= 4) {
    const step = around.length / 4;
    push([0, 1, 2, 3].map((index) => around[Math.min(around.length - 1, Math.floor(index * step))]));
  }
  if (around.length >= 3) {
    const offset = around.length > 3 ? 1 : 0;
    const rotated = [...around.slice(offset), ...around.slice(0, offset)];
    push(rotated.slice(0, Math.min(4, rotated.length)));
  }
  const unique: LatLon[][] = [];
  for (const set of sets) {
    const key = set.map((point) => `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`).join("|");
    if (!unique.some((existing) => existing.map((point) => `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`).join("|") === key)) {
      unique.push(set);
    }
  }
  return unique.slice(0, 2);
}

function gridKey(point: LatLon): string {
  const x = Math.round((point.lon * 111_320 * Math.cos((point.lat * Math.PI) / 180)) / 40);
  const y = Math.round((point.lat * 111_320) / 40);
  return `${x}:${y}`;
}

function segmentJunction(a0: LatLon, a1: LatLon, b0: LatLon, b1: LatLon, nearMeters: number): LatLon | null {
  const ab = localMeters(a0, a1);
  const ac = localMeters(a0, b0);
  const ad = localMeters(a0, b1);
  const sx = ad.x - ac.x;
  const sy = ad.y - ac.y;
  const denom = ab.x * sy - ab.y * sx;
  if (Math.abs(denom) > 1e-6) {
    const t = (ac.x * sy - ac.y * sx) / denom;
    const u = (ac.x * ab.y - ac.y * ab.x) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        lat: a0.lat + (a1.lat - a0.lat) * t,
        lon: a0.lon + (a1.lon - a0.lon) * t,
      };
    }
  }
  const ends: Array<[LatLon, LatLon, LatLon]> = [
    [a0, b0, b1],
    [a1, b0, b1],
    [b0, a0, a1],
    [b1, a0, a1],
  ];
  for (const [end, start, far] of ends) {
    if (distanceToSegmentMeters(end, start, far) <= nearMeters) {
      return projectToSegment(end, start, far);
    }
  }
  return null;
}

function dedupePoints(points: LatLon[], minMeters: number): LatLon[] {
  const kept: LatLon[] = [];
  for (const point of points) {
    if (kept.every((existing) => distanceKm(existing.lat, existing.lon, point.lat, point.lon) * 1000 > minMeters)) {
      kept.push(point);
    }
  }
  return kept;
}

export function isParkOrRiverbank(point: LatLon, parks: LatLon[][], waters: LatLon[][]): boolean {
  const inPark = parks.some(
    (ring) => ring.length >= 3 && (pointInRing(point, ring) || segmentNearLines(point, [ring], 25)),
  );
  return inPark || (waters.length > 0 && segmentNearLines(point, waters, WATER_NEAR_METERS));
}

function densifyRoute(coordinates: LatLon[], spacingMeters: number): LatLon[] {
  const samples: LatLon[] = [coordinates[0]];
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const point = coordinates[index];
    const step =
      distanceKm(previous.lat, previous.lon, point.lat, point.lon) * 1000;
    const count = Math.max(0, Math.floor(step / spacingMeters));
    for (let part = 1; part <= count; part += 1) {
      const ratio = (part * spacingMeters) / step;
      samples.push({
        lat: previous.lat + (point.lat - previous.lat) * ratio,
        lon: previous.lon + (point.lon - previous.lon) * ratio,
      });
    }
    const last = samples[samples.length - 1];
    if (last.lat !== point.lat || last.lon !== point.lon) {
      samples.push(point);
    }
  }
  return samples;
}

export function retraceMeters(
  coordinates: LatLon[],
  corridorMeters = RETRACE_CORRIDOR_METERS,
  minAlongMeters = RETRACE_MIN_ALONG_METERS,
  joinMeters = RETRACE_JOIN_METERS,
  allow?: (point: LatLon) => boolean,
): number {
  if (coordinates.length < 4) {
    return 0;
  }
  const total = routeLengthKm(coordinates) * 1000;
  if (total < minAlongMeters * 2) {
    return 0;
  }
  const spacing = Math.max(40, total / 500);
  const samples = densifyRoute(coordinates, spacing);
  const along: number[] = [0];
  for (let index = 1; index < samples.length; index += 1) {
    along.push(
      along[index - 1] +
        distanceKm(samples[index - 1].lat, samples[index - 1].lon, samples[index].lat, samples[index].lon) * 1000,
    );
  }
  const length = along[along.length - 1];
  const flagged = new Array<boolean>(samples.length).fill(false);
  for (let left = 0; left < samples.length; left += 1) {
    for (let right = left + 1; right < samples.length; right += 1) {
      const gap = along[right] - along[left];
      if (gap < minAlongMeters || gap > length - joinMeters) {
        continue;
      }
      const across =
        distanceKm(samples[left].lat, samples[left].lon, samples[right].lat, samples[right].lon) * 1000;
      if (across <= corridorMeters) {
        if (allow?.(samples[left]) && allow(samples[right])) {
          continue;
        }
        if (!allow?.(samples[left])) {
          flagged[left] = true;
        }
        if (!allow?.(samples[right])) {
          flagged[right] = true;
        }
      }
    }
  }
  const flaggedCount = flagged.filter(Boolean).length;
  if (flaggedCount === 0) {
    return 0;
  }
  return (flaggedCount / samples.length) * length;
}

export function overlapRatio(coordinates: LatLon[]): number {
  const totalMeters = routeLengthKm(coordinates) * 1000;
  if (!(totalMeters > 0)) {
    return 1;
  }
  const stem = accessStem(coordinates);
  const middle = totalMeters - stem.meters * 2;
  const forgive = stem.meters >= 80 && middle >= Math.max(400, totalMeters * 0.2);
  const allow = forgive
    ? (point: LatLon) => nearPolyline(point, stem.line, RETRACE_CORRIDOR_METERS)
    : undefined;
  return retraceMeters(coordinates, RETRACE_CORRIDOR_METERS, RETRACE_MIN_ALONG_METERS, RETRACE_JOIN_METERS, allow) / totalMeters;
}

function accessStem(coordinates: LatLon[]): { meters: number; line: LatLon[] } {
  if (coordinates.length < 4) {
    return { meters: 0, line: [] };
  }
  const total = routeLengthKm(coordinates) * 1000;
  if (!(total > 0)) {
    return { meters: 0, line: [] };
  }
  const samples = densifyRoute(coordinates, Math.max(40, total / 500));
  const along: number[] = [0];
  for (let index = 1; index < samples.length; index += 1) {
    along.push(
      along[index - 1] + distanceKm(samples[index - 1].lat, samples[index - 1].lon, samples[index].lat, samples[index].lon) * 1000,
    );
  }
  let meters = 0;
  let inbound = samples.length - 1;
  for (let outbound = 0; outbound < samples.length / 2; outbound += 1) {
    const target = total - along[outbound];
    while (inbound > outbound && along[inbound] > target + 50) {
      inbound -= 1;
    }
    let near = Number.POSITIVE_INFINITY;
    for (let cursor = inbound; cursor > outbound && along[cursor] >= target - 80; cursor -= 1) {
      const across = distanceKm(samples[outbound].lat, samples[outbound].lon, samples[cursor].lat, samples[cursor].lon) * 1000;
      if (across < near) {
        near = across;
      }
    }
    if (near > 60) {
      break;
    }
    meters = along[outbound];
  }
  const line = samples.filter((_, index) => along[index] <= meters + 40);
  return { meters, line };
}

function nearPolyline(point: LatLon, line: LatLon[], meters: number): boolean {
  for (let index = 1; index < line.length; index += 1) {
    if (distanceToSegmentMeters(point, line[index - 1], line[index]) <= meters) {
      return true;
    }
  }
  return false;
}

export function dropRetraces(coordinates: LatLon[], corridorMeters = 18, allow?: (point: LatLon) => boolean): LatLon[] {
  if (coordinates.length < 4) {
    return coordinates;
  }
  const kept: LatLon[] = [coordinates[0]];
  for (let index = 1; index < coordinates.length; index += 1) {
    const point = coordinates[index];
    const tip = kept[kept.length - 1];
    const step = distanceKm(tip.lat, tip.lon, point.lat, point.lon) * 1000;
    if (step < 8) {
      continue;
    }
    const previous = kept[kept.length - 2];
    const turningBack =
      previous != null &&
      distanceKm(point.lat, point.lon, previous.lat, previous.lon) * 1000 <= corridorMeters &&
      turnDelta(bearingDeg(previous, tip), bearingDeg(tip, point)) >= 150;
    if (turningBack && kept.length > 2 && !allow?.(tip) && !allow?.(point) && !allow?.(previous)) {
      kept.pop();
      const base = kept[kept.length - 1];
      if (distanceKm(base.lat, base.lon, point.lat, point.lon) * 1000 > corridorMeters) {
        kept.push(point);
      }
      continue;
    }
    kept.push(point);
  }
  return kept;
}

export function straightenShortSpikes(coordinates: LatLon[], maxDetourMeters = 480, rejoinMeters = 55): LatLon[] {
  if (coordinates.length < 4) {
    return coordinates;
  }
  const points = coordinates.map((point) => ({ ...point }));
  for (let pass = 0; pass < 16; pass += 1) {
    const along = [0];
    for (let index = 1; index < points.length; index += 1) {
      along.push(
        along[index - 1] + distanceKm(points[index - 1].lat, points[index - 1].lon, points[index].lat, points[index].lon) * 1000,
      );
    }
    let removed = false;
    for (let start = 0; start < points.length - 2 && !removed; start += 1) {
      for (let end = start + 2; end < points.length; end += 1) {
        const detour = along[end] - along[start];
        if (detour > maxDetourMeters) {
          break;
        }
        if (detour < 20) {
          continue;
        }
        const back = distanceKm(points[start].lat, points[start].lon, points[end].lat, points[end].lon) * 1000;
        const ratioNeeded = detour < 90 ? 1.35 : 2.2;
        if (back > rejoinMeters || detour < back * ratioNeeded) {
          continue;
        }
        const leftover = along[along.length - 1] - detour;
        if (leftover < Math.max(200, along[along.length - 1] * 0.45)) {
          continue;
        }
        points.splice(start + 1, end - start - 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      break;
    }
  }
  const compact: LatLon[] = [];
  for (const point of points) {
    const previous = compact[compact.length - 1];
    if (previous && distanceKm(previous.lat, previous.lon, point.lat, point.lon) * 1000 < 8) {
      continue;
    }
    compact.push(point);
  }
  return compact.length >= 4 ? compact : coordinates;
}

/**
 * 車線・歩道の細かい乗り換えのような短い折れを直線に直す。
 * @param coordinates 経路の点列
 * @param maxLegMeters 1辺の上限（m）
 * @param maxOffsetMeters 本線からの横ずれ上限（m）。大きい角は残す
 * @returns 補正後の点列
 */
export function flattenLaneHops(coordinates: LatLon[], maxLegMeters = 120, maxOffsetMeters = 55): LatLon[] {
  if (coordinates.length < 3) {
    return coordinates;
  }
  const kept: LatLon[] = [coordinates[0]];
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const previous = kept[kept.length - 1];
    const before = kept.length >= 2 ? kept[kept.length - 2] : null;
    const mid = coordinates[index];
    const next = coordinates[index + 1];
    const leg1 = distanceKm(previous.lat, previous.lon, mid.lat, mid.lon) * 1000;
    const leg2 = distanceKm(mid.lat, mid.lon, next.lat, next.lon) * 1000;
    const chord = distanceKm(previous.lat, previous.lon, next.lat, next.lon) * 1000;
    const offset = distanceToSegmentMeters(mid, previous, next);
    const inbound =
      before == null ? 0 : signedTurnDeg(bearingDeg(before, previous), bearingDeg(previous, mid));
    const outbound = signedTurnDeg(bearingDeg(previous, mid), bearingDeg(mid, next));
    // 左右に振り戻す乗り換えだけ落とす（本線上の中間点は残す）
    const zigzag = before != null && inbound * outbound < 0 && Math.abs(inbound) >= 25 && Math.abs(outbound) >= 50;
    if (
      zigzag &&
      leg1 > 4 &&
      leg2 > 4 &&
      leg1 <= maxLegMeters &&
      leg2 <= maxLegMeters &&
      chord > 8 &&
      offset >= 8 &&
      offset <= maxOffsetMeters &&
      leg1 + leg2 > chord * 1.2
    ) {
      continue;
    }
    kept.push(mid);
  }
  kept.push(coordinates[coordinates.length - 1]);
  const compact: LatLon[] = [];
  for (const point of kept) {
    const previous = compact[compact.length - 1];
    if (previous && distanceKm(previous.lat, previous.lon, point.lat, point.lon) * 1000 < 8) {
      continue;
    }
    compact.push(point);
  }
  return compact.length >= 2 ? compact : coordinates;
}

/**
 * 短い折り返しと車線乗り換えをまとめて直す。
 * @param coordinates 経路の点列
 * @returns 補正後の点列
 */
export function cleanCourseGeometry(coordinates: LatLon[]): LatLon[] {
  return dropRetraces(flattenLaneHops(straightenShortSpikes(coordinates)), 28);
}

export function countUturns(coordinates: LatLon[], minLegMeters = TURN_MIN_LEG_METERS): number {
  let count = 0;
  let heading: number | null = null;
  let anchor: LatLon | null = null;
  for (const point of coordinates) {
    if (anchor == null) {
      anchor = point;
      continue;
    }
    const legMeters = distanceKm(anchor.lat, anchor.lon, point.lat, point.lon) * 1000;
    if (legMeters < minLegMeters) {
      continue;
    }
    const next = bearingDeg(anchor, point);
    if (heading != null && turnDelta(heading, next) >= 150) {
      count += 1;
    }
    heading = next;
    anchor = point;
  }
  return count;
}

function localMeters(origin: LatLon, point: LatLon): { x: number; y: number } {
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lon - origin.lon) * lonScale,
    y: (point.lat - origin.lat) * latScale,
  };
}

function projectToSegment(point: LatLon, start: LatLon, end: LatLon): LatLon {
  const origin = start;
  const projected = localMeters(origin, point);
  const far = localMeters(origin, end);
  const lengthSq = far.x * far.x + far.y * far.y;
  if (lengthSq === 0) {
    return start;
  }
  const t = Math.min(1, Math.max(0, (projected.x * far.x + projected.y * far.y) / lengthSq));
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lon: start.lon + (end.lon - start.lon) * t,
  };
}

export function nearestOnLines(point: LatLon, lines: LatLon[][], maxMeters: number): LatLon | null {
  let best: LatLon | null = null;
  let bestMeters = maxMeters;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const snapped = projectToSegment(point, line[index - 1], line[index]);
      const meters = distanceKm(point.lat, point.lon, snapped.lat, snapped.lon) * 1000;
      if (meters <= bestMeters) {
        best = snapped;
        bestMeters = meters;
      }
    }
  }
  return best;
}

export function lengthNearLinesKm(route: LatLon[], lines: LatLon[][], maxMeters: number): number {
  if (route.length < 2 || lines.length === 0) {
    return 0;
  }
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const mid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    if (nearestOnLines(mid, lines, maxMeters)) {
      total += distanceKm(start.lat, start.lon, end.lat, end.lon);
    }
  }
  return total;
}

const PARK_EDGE_METERS = 12;

/** 点が公園の輪の中か、輪の縁の近くか。穴の中は公園に入れない。 */
export function pointInPark(point: LatLon, parks: LatLon[][], holes: LatLon[][] = []): boolean {
  return segmentInPark(point, parks, holes);
}

/** スタート可能とみなす、起点から道までの距離の上限（m）。 */
export const STARTABLE_ROAD_METERS = 80;
/** 起点移動の案内として地図に出す走りやすい道の探索半径（m）。 */
export const HINT_ROAD_METERS = 800;
/** 結果ルート周辺に重ねる走りやすい道の探索半径（m）。 */
export const ROUTE_HINT_ROAD_METERS = 220;
/** 地図に出す走りやすい道の本数上限（起点案内）。 */
export const HINT_ROAD_LIMIT = 16;
/** 地図に出す走りやすい道の本数上限（結果ルート周辺）。 */
export const ROUTE_HINT_ROAD_LIMIT = 48;

export type CourseRoadStart = { point: LatLon; meters: number };

/** 各採点項目の満点。 */
export const SCORE_PART_MAX = {
  distance: SCORE_DISTANCE,
  easy: SCORE_EASY,
  straight: SCORE_STRAIGHT,
  turns: SCORE_TURNS,
  overlap: SCORE_OVERLAP,
  signals: SCORE_SIGNALS,
  clockwise: SCORE_CLOCKWISE,
  uturn: SCORE_UTURN,
  minor: SCORE_MINOR,
  junctions: SCORE_JUNCTIONS,
} as const;

function keepSpreadRoads(
  scored: { coordinates: LatLon[]; meters: number }[],
  limit: number,
): LatLon[][] {
  const kept: LatLon[][] = [];
  for (const road of scored) {
    const near = kept.some((existing) => {
      const a = existing[Math.floor(existing.length / 2)];
      const b = road.coordinates[Math.floor(road.coordinates.length / 2)];
      return distanceKm(a.lat, a.lon, b.lat, b.lon) * 1000 < 80;
    });
    if (near) {
      continue;
    }
    kept.push(road.coordinates);
    if (kept.length >= limit) {
      break;
    }
  }
  return kept;
}

/**
 * 起点移動の案内用に、周辺の走りやすい道を近い順で返す。
 * @param start 地図で選んだ地点
 * @param roads 周囲の道
 * @param maxMeters 探索半径（m）
 * @param limit 返す本数の上限
 * @returns 道の座標列
 */
export function nearbyEasyRoadHints(
  start: LatLon,
  roads: { coordinates: LatLon[]; easy?: boolean }[],
  maxMeters = HINT_ROAD_METERS,
  limit = HINT_ROAD_LIMIT,
): LatLon[][] {
  const scored = roads
    .filter((road) => road.easy === true && road.coordinates.length >= 2)
    .map((road) => {
      let best = Number.POSITIVE_INFINITY;
      for (const point of road.coordinates) {
        const meters = distanceKm(start.lat, start.lon, point.lat, point.lon) * 1000;
        if (meters < best) {
          best = meters;
        }
      }
      return { coordinates: road.coordinates, meters: best };
    })
    .filter((road) => road.meters <= maxMeters)
    .sort((left, right) => left.meters - right.meters);
  return keepSpreadRoads(scored, limit);
}

/**
 * 結果ルートの近くにある走りやすい道を返す（結果表示の背景線用）。
 * @param routes 表示する周回の座標列
 * @param roads 周囲の道
 * @param maxMeters ルートからの探索半径（m）
 * @param limit 返す本数の上限
 * @returns 道の座標列
 */
export function easyRoadHintsNearRoutes(
  routes: LatLon[][],
  roads: { coordinates: LatLon[]; easy?: boolean }[],
  maxMeters = ROUTE_HINT_ROAD_METERS,
  limit = ROUTE_HINT_ROAD_LIMIT,
): LatLon[][] {
  const samples = routes.flatMap((route) => sampleRoute(route, 120, 40));
  if (samples.length === 0) {
    return [];
  }
  const scored = roads
    .filter((road) => road.easy === true && road.coordinates.length >= 2)
    .map((road) => {
      let best = Number.POSITIVE_INFINITY;
      for (const point of road.coordinates) {
        for (const sample of samples) {
          const meters = distanceKm(sample.lat, sample.lon, point.lat, point.lon) * 1000;
          if (meters < best) {
            best = meters;
          }
          if (best <= maxMeters) {
            break;
          }
        }
        if (best <= maxMeters) {
          break;
        }
      }
      return { coordinates: road.coordinates, meters: best };
    })
    .filter((road) => road.meters <= maxMeters)
    .sort((left, right) => left.meters - right.meters);
  return keepSpreadRoads(scored, limit);
}

/**
 * 周回のスタートに使えるいちばん近い道（走りやすい道または接続道路）。
 * 細い道・公園内の通路も含む。広場や山奥で近くに道が無いときは null。
 * @param start 地図で選んだ地点
 * @param roads 周囲の道。easy / connector が付いていればそれを優先して見る
 * @param maxMeters スタート可能とみなす距離（m）
 * @returns 道の上の点と距離。近くに道が無いときは null
 */
export function nearestStartableRoad(
  start: LatLon,
  roads: {
    coordinates: LatLon[];
    highway: string;
    tags?: OsmWayTags;
    easy?: boolean;
    connector?: boolean;
  }[],
  maxMeters = STARTABLE_ROAD_METERS,
): CourseRoadStart | null {
  let best: CourseRoadStart | null = null;
  for (const road of roads) {
    const tags = road.tags ?? { highway: road.highway };
    const startable =
      road.easy === true ||
      road.connector === true ||
      (road.easy == null &&
        road.connector == null &&
        (isEasyRoadByTags(tags) || isConnectorRoad(tags, road.coordinates)));
    if (!startable || road.coordinates.length < 2) {
      continue;
    }
    for (let index = 1; index < road.coordinates.length; index += 1) {
      const from = road.coordinates[index - 1];
      const to = road.coordinates[index];
      const point = projectToSegment(start, from, to);
      const meters = distanceKm(start.lat, start.lon, point.lat, point.lon) * 1000;
      if (meters > maxMeters || (best != null && meters >= best.meters)) {
        continue;
      }
      best = { point, meters };
    }
  }
  return best;
}

function segmentInPark(point: LatLon, parks: LatLon[][], holes: LatLon[][]): boolean {
  if (holes.some((ring) => ring.length >= 3 && pointInRing(point, ring))) {
    return false;
  }
  return parks.some((ring) => {
    if (ring.length < 3) {
      return false;
    }
    return pointInRing(point, ring) || segmentNearLines(point, [ring], PARK_EDGE_METERS);
  });
}

/**
 * 走りやすい道路か。OSM タグと、河川 40m 以内、公園内の通路を見る。
 * @param highwayOrTags highway 文字列、またはタグ全体
 * @param coordinates Way の座標
 * @param parks 公園の外周
 * @param waters 河川の線
 * @param parkHoles 公園の穴
 * @returns 走りやすい道路のとき true
 */
export function isEasyRoad(
  highwayOrTags: string | OsmWayTags,
  coordinates: LatLon[],
  parks: LatLon[][],
  waters: LatLon[][],
  parkHoles: LatLon[][] = [],
): boolean {
  const tags: OsmWayTags = typeof highwayOrTags === "string" ? { highway: highwayOrTags } : highwayOrTags;
  if (isExcludedRoad(tags)) {
    return false;
  }
  if (isEasyRoadByTags(tags)) {
    return true;
  }
  if (lengthNearLinesKm(coordinates, waters, WATER_NEAR_METERS) > 0) {
    return true;
  }
  const highway = tagValue(tags, "highway");
  const parkPath = /^(path|footway|pedestrian|track)$/.test(highway);
  if (!parkPath) {
    return false;
  }
  const total = routeLengthKm(coordinates);
  if (!(total > 0) || parks.length === 0) {
    return false;
  }
  let inside = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const mid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    if (segmentInPark(mid, parks, parkHoles)) {
      inside += distanceKm(start.lat, start.lon, end.lat, end.lon);
    }
  }
  return inside / total >= 0.5;
}

function distanceToSegmentMeters(point: LatLon, start: LatLon, end: LatLon): number {
  const origin = start;
  const p = localMeters(origin, point);
  const b = localMeters(origin, end);
  const lengthSq = b.x * b.x + b.y * b.y;
  if (lengthSq === 0) {
    return Math.hypot(p.x, p.y);
  }
  const t = Math.min(1, Math.max(0, (p.x * b.x + p.y * b.y) / lengthSq));
  return Math.hypot(p.x - b.x * t, p.y - b.y * t);
}

function nearestAlongMeters(route: LatLon[], point: LatLon): { meters: number; along: number; total: number } | null {
  if (route.length < 2) {
    return null;
  }
  let bestMeters = Number.POSITIVE_INFINITY;
  let bestAlong = 0;
  let along = 0;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const step = distanceKm(start.lat, start.lon, end.lat, end.lon) * 1000;
    const origin = start;
    const projected = localMeters(origin, point);
    const far = localMeters(origin, end);
    const lengthSq = far.x * far.x + far.y * far.y;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (projected.x * far.x + projected.y * far.y) / lengthSq));
    const meters = Math.hypot(projected.x - far.x * t, projected.y - far.y * t);
    if (meters < bestMeters) {
      bestMeters = meters;
      bestAlong = along + step * t;
    }
    along += step;
  }
  return { meters: bestMeters, along: bestAlong, total: along };
}

function pointAlong(route: LatLon[], alongMeters: number): LatLon {
  let along = 0;
  const target = Math.max(0, alongMeters);
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const step = distanceKm(start.lat, start.lon, end.lat, end.lon) * 1000;
    if (along + step >= target || index === route.length - 1) {
      const ratio = step > 0 ? Math.min(1, Math.max(0, (target - along) / step)) : 0;
      return {
        lat: start.lat + (end.lat - start.lat) * ratio,
        lon: start.lon + (end.lon - start.lon) * ratio,
      };
    }
    along += step;
  }
  return route[route.length - 1];
}

function wrapAlong(along: number, total: number): number {
  if (!(total > 0)) {
    return 0;
  }
  return ((along % total) + total) % total;
}

function crossesRoadAtSignal(signal: LatLon, routeBearing: number, majors: LatLon[][]): boolean {
  for (const line of majors) {
    for (let index = 1; index < line.length; index += 1) {
      if (distanceToSegmentMeters(signal, line[index - 1], line[index]) > SIGNAL_ROAD_CROSS_METERS) {
        continue;
      }
      const delta = turnDelta(routeBearing, bearingDeg(line[index - 1], line[index]));
      if (delta >= TURN_MIN_DEG && delta <= 180 - TURN_MIN_DEG) {
        return true;
      }
    }
  }
  return false;
}

export function countCrossedSignals(
  route: LatLon[],
  signals: LatLon[],
  maxMeters = SIGNAL_NEAR_METERS,
  majors: LatLon[][] = [],
): number {
  const closed =
    route.length > 2 &&
    distanceKm(route[0].lat, route[0].lon, route[route.length - 1].lat, route[route.length - 1].lon) * 1000 < 40;
  const hits: number[] = [];
  let routeTotal = 0;
  for (const signal of signals) {
    const nearest = nearestAlongMeters(route, signal);
    if (nearest == null || nearest.meters > maxMeters || !(nearest.total > 0)) {
      continue;
    }
    const beforeAlong = nearest.along - SIGNAL_CROSS_WINDOW_METERS;
    const afterAlong = nearest.along + SIGNAL_CROSS_WINDOW_METERS;
    if (!closed && (beforeAlong < 0 || afterAlong > nearest.total)) {
      continue;
    }
    const before = pointAlong(route, closed ? wrapAlong(beforeAlong, nearest.total) : beforeAlong);
    const here = pointAlong(route, nearest.along);
    const after = pointAlong(route, closed ? wrapAlong(afterAlong, nearest.total) : afterAlong);
    const inbound = bearingDeg(before, here);
    const outbound = bearingDeg(here, after);
    const turning = turnDelta(inbound, outbound) >= TURN_MIN_DEG;
    const throughJunction = nearest.meters <= SIGNAL_STRAIGHT_CROSS_METERS;
    const crossingRoad = crossesRoadAtSignal(signal, inbound, majors);
    if (!turning && !throughJunction && !crossingRoad) {
      continue;
    }
    hits.push(nearest.along);
    routeTotal = nearest.total;
  }
  hits.sort((left, right) => left - right);
  let count = 0;
  let last = Number.NEGATIVE_INFINITY;
  for (const along of hits) {
    if (along - last >= SIGNAL_CLUSTER_METERS) {
      count += 1;
    }
    last = along;
  }
  if (closed && count > 1 && hits[0] + routeTotal - hits[hits.length - 1] < SIGNAL_CLUSTER_METERS) {
    count -= 1;
  }
  return count;
}

export function countNearRoute(route: LatLon[], points: LatLon[], maxMeters: number): number {
  if (route.length === 0 || points.length === 0) {
    return 0;
  }
  let count = 0;
  for (const point of points) {
    let near = false;
    if (route.length === 1) {
      near = distanceKm(point.lat, point.lon, route[0].lat, route[0].lon) * 1000 <= maxMeters;
    }
    for (let index = 1; index < route.length; index += 1) {
      if (distanceToSegmentMeters(point, route[index - 1], route[index]) <= maxMeters) {
        near = true;
        break;
      }
    }
    if (near) {
      count += 1;
    }
  }
  return count;
}

function pointInRing(point: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index];
    const prior = ring[previous];
    const crosses = current.lat > point.lat !== prior.lat > point.lat;
    if (!crosses) {
      continue;
    }
    const x = ((prior.lon - current.lon) * (point.lat - current.lat)) / (prior.lat - current.lat) + current.lon;
    if (point.lon < x) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentNearLines(mid: LatLon, lines: LatLon[][], maxMeters: number): boolean {
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      if (distanceToSegmentMeters(mid, line[index - 1], line[index]) <= maxMeters) {
        return true;
      }
    }
  }
  return false;
}

export function featureLengthKm(
  route: LatLon[],
  parks: LatLon[][],
  waters: LatLon[][],
  waterMeters = WATER_NEAR_METERS,
): number {
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const mid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    const inPark = parks.some((ring) => ring.length >= 3 && pointInRing(mid, ring));
    const nearWater = waters.length > 0 && segmentNearLines(mid, waters, waterMeters);
    if (inPark || nearWater) {
      total += distanceKm(start.lat, start.lon, end.lat, end.lon);
    }
  }
  return total;
}

/**
 * 道が公園の縁や水域の近くを通るか。
 * 園内そのものより、堀・公園外周に沿う道を周回探索で拾うために使う。
 * @param coordinates Way の座標
 * @param parks 公園の外周
 * @param waters 河川・堀などの線
 * @param nearMeters 近傍とみなす距離
 * @returns サンプルの一定以上が縁・水域に近いとき true
 */
export function wayAlongParkOrWater(
  coordinates: LatLon[],
  parks: LatLon[][],
  waters: LatLon[][],
  nearMeters = FEATURE_EDGE_NEAR_METERS,
): boolean {
  if (coordinates.length < 2 || (parks.length === 0 && waters.length === 0)) {
    return false;
  }
  let hits = 0;
  let samples = 0;
  const probe = (point: LatLon) => {
    samples += 1;
    const nearParkEdge = parks.some(
      (ring) => ring.length >= 2 && segmentNearLines(point, [ring], nearMeters),
    );
    const nearWater = waters.length > 0 && segmentNearLines(point, waters, nearMeters);
    if (nearParkEdge || nearWater) {
      hits += 1;
    }
  };
  probe(coordinates[0]);
  probe(coordinates[coordinates.length - 1]);
  for (let index = 1; index < coordinates.length; index += 1) {
    probe({
      lat: (coordinates[index - 1].lat + coordinates[index].lat) / 2,
      lon: (coordinates[index - 1].lon + coordinates[index].lon) / 2,
    });
  }
  return samples > 0 && hits / samples >= 0.4;
}

/**
 * 周回の外接が指定の矩形をほぼ覆うか（大きな公園一周の目安）。
 * @param coordinates 周回の座標
 * @param box 覆いたい範囲
 * @returns 周回の bbox が box の各辺を内側からほぼ含むとき true
 */
export function loopCoversBbox(
  coordinates: LatLon[],
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  slack = 0.002,
): boolean {
  if (coordinates.length < 3) {
    return false;
  }
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
  return (
    minLat <= box.minLat + slack &&
    maxLat >= box.maxLat - slack &&
    minLon <= box.minLon + slack &&
    maxLon >= box.maxLon - slack
  );
}

export function elevationChange(meters: number[]): { ascentM: number; descentM: number } {
  let ascent = 0;
  let descent = 0;
  let previous: number | null = null;
  for (const value of meters) {
    if (!Number.isFinite(value)) {
      continue;
    }
    if (previous != null) {
      const delta = value - previous;
      if (delta > 0) {
        ascent += delta;
      } else {
        descent += -delta;
      }
    }
    previous = value;
  }
  return { ascentM: Math.round(ascent), descentM: Math.round(descent) };
}

export type CourseScoreInput = {
  distanceKm: number;
  targetKm: number;
  easyRatio: number;
  minorRatio: number;
  turnCount: number;
  signalCount: number;
  junctionCount: number;
  overlapRatio: number;
  meanLegMeters: number;
  longestLegMeters: number;
  shortLegCount: number;
  clockwiseDeg: number;
  uturnCount: number;
};

export function courseScoreParts(input: CourseScoreInput): CourseScoreParts {
  const limitKm = input.targetKm * COURSE_DISTANCE_TOLERANCE;
  const distanceFit = limitKm > 0 ? Math.max(0, 1 - Math.abs(input.distanceKm - input.targetKm) / limitKm) : 0;
  const sideMeters = (input.targetKm * 1000) / 4;
  const meanFit = sideMeters > 0 ? Math.min(1, input.meanLegMeters / sideMeters) : 0;
  const longestFit = sideMeters > 0 ? Math.min(1, input.longestLegMeters / sideMeters) : 0;
  const straightFit = Math.max(0, meanFit * 0.5 + longestFit * 0.5 - Math.min(0.5, input.shortLegCount * 0.08));
  const perKm = Math.max(input.distanceKm, 0.1);
  const turnsPerKm = input.turnCount / perKm;
  const turnSpan = Math.max(0.1, TURN_ZERO_PER_KM - TURN_FULL_PER_KM);
  const turnFit = Math.max(0, 1 - Math.max(0, turnsPerKm - TURN_FULL_PER_KM) / turnSpan);
  const overlapFit = Math.max(0, 1 - Math.min(1, input.overlapRatio / OVERLAP_ZERO_RATIO));
  const signalFit = Math.max(0, 1 - input.signalCount / perKm / SIGNAL_ZERO_PER_KM);
  const distance = SCORE_DISTANCE * distanceFit;
  const easy = SCORE_EASY * Math.max(0, Math.min(1, input.easyRatio));
  const straight = SCORE_STRAIGHT * straightFit;
  const turns = SCORE_TURNS * turnFit;
  const overlap = SCORE_OVERLAP * overlapFit;
  const signals = SCORE_SIGNALS * signalFit;
  const clockwise = 0;
  const uturn = 0;
  const minorFit = MINOR_ZERO_RATIO > 0 ? Math.max(0, 1 - Math.min(1, input.minorRatio / MINOR_ZERO_RATIO)) : 0;
  const minor = SCORE_MINOR * minorFit;
  const junctions = SCORE_JUNCTIONS;
  return {
    distance,
    easy,
    straight,
    turns,
    overlap,
    signals,
    clockwise,
    uturn,
    minor,
    junctions,
    total: distance + easy + straight + turns + overlap + signals + minor,
  };
}

export function courseScore(input: CourseScoreInput): number {
  return courseScoreParts(input).total;
}

const SCORE_PART_KEYS = [
  "distance",
  "easy",
  "minor",
  "straight",
  "signals",
  "turns",
  "overlap",
] as const;

function roundScorePoint(value: number): number {
  return Math.round(value * 10) / 10;
}

function snapshotScoreParts(parts: CourseScoreParts, total: number): CourseScoreParts {
  return {
    distance: roundScorePoint(parts.distance),
    easy: roundScorePoint(parts.easy),
    straight: roundScorePoint(parts.straight),
    turns: roundScorePoint(parts.turns),
    overlap: roundScorePoint(parts.overlap),
    signals: roundScorePoint(parts.signals),
    clockwise: roundScorePoint(parts.clockwise),
    uturn: roundScorePoint(parts.uturn),
    minor: roundScorePoint(parts.minor),
    junctions: roundScorePoint(parts.junctions),
    total: roundScorePoint(total),
  };
}

export function relativeCourseScores<T extends { score: number; scoreParts: CourseScoreParts }>(
  courses: T[],
): Array<T & { rawScore: number; rawScoreParts: CourseScoreParts }> {
  const top = courses.reduce((max, course) => Math.max(max, course.score), 0);
  return courses.map((course) => {
    const rawScore = roundScorePoint(course.score);
    const rawScoreParts = snapshotScoreParts(course.scoreParts, rawScore);
    if (!(top > 0)) {
      return { ...course, score: rawScore, scoreParts: rawScoreParts, rawScore, rawScoreParts };
    }
    const factor = 100 / top;
    const parts: CourseScoreParts = {
      distance: 0,
      easy: 0,
      straight: 0,
      turns: 0,
      overlap: 0,
      signals: 0,
      clockwise: 0,
      uturn: 0,
      minor: 0,
      junctions: 0,
      total: 0,
    };
    for (const key of SCORE_PART_KEYS) {
      parts[key] = roundScorePoint(course.scoreParts[key] * factor);
    }
    let sum = roundScorePoint(SCORE_PART_KEYS.reduce((total, key) => total + parts[key], 0));
    const target = course.score >= top - 1e-9 ? 100 : sum;
    const drift = roundScorePoint(target - sum);
    if (drift !== 0) {
      const key = SCORE_PART_KEYS.reduce((best, current) => (parts[current] > parts[best] ? current : best));
      parts[key] = roundScorePoint(parts[key] + drift);
      sum = roundScorePoint(SCORE_PART_KEYS.reduce((total, item) => total + parts[item], 0));
    }
    parts.total = sum;
    return { ...course, score: sum, scoreParts: parts, rawScore, rawScoreParts };
  });
}

export function sameCourseLine(left: LatLon[], right: LatLon[], nearMeters = 40): boolean {
  const samples = sampleRoute(left, 200, 40);
  if (samples.length === 0 || right.length < 2) {
    return false;
  }
  let near = 0;
  for (const sample of samples) {
    const close = right.some((_, index) => {
      if (index === 0) {
        return false;
      }
      return distanceToSegmentMeters(sample, right[index - 1], right[index]) <= nearMeters;
    });
    if (close) {
      near += 1;
    }
  }
  return near / samples.length >= 0.92;
}

export function preferDistinctRoutes<T extends { coordinates: LatLon[]; score: number; featureKm?: number }>(
  routes: T[],
  limit = COURSE_PROPOSAL_LIMIT,
): T[] {
  const ranked = [...routes].sort(
    (left, right) => right.score - left.score || (right.featureKm ?? 0) - (left.featureKm ?? 0),
  );
  const kept: T[] = [];
  for (const route of ranked) {
    if (kept.some((existing) => sameCourseLine(existing.coordinates, route.coordinates))) {
      continue;
    }
    kept.push(route);
    if (kept.length >= limit) {
      break;
    }
  }
  return kept;
}

export function nearestMajorBearing(start: LatLon, lines: LatLon[][]): number {
  let bestMeters = Number.POSITIVE_INFINITY;
  let bearing = 0;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const meters = distanceToSegmentMeters(start, line[index - 1], line[index]);
      if (meters < bestMeters) {
        bestMeters = meters;
        bearing = bearingDeg(line[index - 1], line[index]);
      }
    }
  }
  return bearing;
}

function shiftPoint(origin: LatLon, headingDeg: number, alongKm: number, rightKm: number): LatLon {
  const moved = destinationPoint(origin, headingDeg, alongKm);
  return destinationPoint(moved, (headingDeg + 90 + 360) % 360, rightKm);
}

function closeLoop(start: LatLon, vias: LatLon[]): LatLon[] | null {
  const kept: LatLon[] = [];
  for (const point of vias) {
    if (distanceKm(start.lat, start.lon, point.lat, point.lon) * 1000 < 80) {
      return null;
    }
    if (kept.some((existing) => distanceKm(existing.lat, existing.lon, point.lat, point.lon) * 1000 < 80)) {
      return null;
    }
    kept.push(point);
  }
  if (kept.length < 3) {
    return null;
  }
  return [start, ...kept, start];
}

function shapeLoop(
  start: LatLon,
  headingDeg: number,
  longKm: number,
  shortKm: number,
  startIndex: number,
  majors: LatLon[][],
  loopKm: number,
): LatLon[] | null {
  const roles = [
    { along: 0, right: 0 },
    { along: longKm / 2, right: 0 },
    { along: longKm, right: 0 },
    { along: longKm, right: shortKm / 2 },
    { along: longKm, right: shortKm },
    { along: longKm / 2, right: shortKm },
    { along: 0, right: shortKm },
    { along: 0, right: shortKm / 2 },
  ];
  const origin = roles[startIndex];
  const limit = snapLimitMeters(loopKm);
  const vias: LatLon[] = [];
  for (let step = 1; step <= roles.length; step += 1) {
    const index = (startIndex + step) % roles.length;
    if (index === startIndex || index % 2 !== 0) {
      continue;
    }
    const role = roles[index];
    const ideal = shiftPoint(start, headingDeg, role.along - origin.along, role.right - origin.right);
    vias.push(nearestOnLines(ideal, majors, limit) ?? ideal);
  }
  return closeLoop(start, vias);
}

function turnLoop(
  start: LatLon,
  loopKm: number,
  headingDeg: number,
  turnDeg: number,
  majors: LatLon[][],
  scale: number,
): LatLon[] | null {
  const legKm = (loopKm / 4) * scale;
  const limit = snapLimitMeters(loopKm);
  let cursor = start;
  let face = headingDeg;
  const vias: LatLon[] = [];
  for (let turn = 0; turn < 3; turn += 1) {
    const ideal = destinationPoint(cursor, face, legKm);
    const snapped = nearestOnLines(ideal, majors, limit) ?? ideal;
    vias.push(snapped);
    cursor = snapped;
    face = (face + turnDeg + 360) % 360;
  }
  return closeLoop(start, vias);
}

function dedupeWaypointSets(sets: LatLon[][]): LatLon[][] {
  const unique: LatLon[][] = [];
  const seen = new Set<string>();
  for (const set of sets) {
    const key = set.map((point) => `${point.lat.toFixed(3)},${point.lon.toFixed(3)}`).join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(set);
  }
  return unique;
}

function appendLoopShapes(
  sets: LatLon[][],
  start: LatLon,
  headingDeg: number,
  sideKm: number,
  longKm: number,
  shortKm: number,
  majors: LatLon[][],
  loopKm: number,
  includeSquare: boolean,
) {
  for (let index = 0; index < 8; index += 1) {
    if (includeSquare) {
      const square = shapeLoop(start, headingDeg, sideKm, sideKm, index, majors, loopKm);
      if (square) {
        sets.push(square);
      }
    }
    const rectangle = shapeLoop(start, headingDeg, longKm, shortKm, index, majors, loopKm);
    if (rectangle) {
      sets.push(rectangle);
    }
  }
}

export function shouldContinueShapeAdjust(inBand: number, medianKm: number, targetKm: number, pass: number): boolean {
  if (inBand >= courseKeepLimit(targetKm)) {
    return false;
  }
  return medianKm > 0 && !acceptCourseDistance(medianKm, targetKm) && pass < SHAPE_ADJUST_LIMIT;
}

export function stepShapeScale(scale: number, medianKm: number, targetKm: number): number {
  if (!(medianKm > 0) || !(targetKm > 0)) {
    return scale;
  }
  const ratio = medianKm > targetKm ? 1 - SHAPE_SCALE_STEP : 1 + SHAPE_SCALE_STEP;
  const next = scale * ratio;
  return Math.min(SHAPE_SCALE_MAX, Math.max(SHAPE_SCALE_MIN, next));
}

export function shuffleWaypointSets<T>(sets: T[], random: () => number = Math.random): T[] {
  const copy = [...sets];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

export function loopWaypointSets(
  start: LatLon,
  loopKm: number,
  bearingDeg: number,
  majors: LatLon[][],
  scale = 1,
): LatLon[][] {
  const sets: LatLon[][] = [];
  const shapeScale = scale * COURSE_SHAPE_SCALE;
  const sideKm = (loopKm / 4) * shapeScale;
  const shortKm = (loopKm / 10) * shapeScale;
  const longKm = shortKm * 4;
  for (const offset of [0, 90, 180, 270]) {
    const heading = (bearingDeg + offset + 360) % 360;
    const clockwise = turnLoop(start, loopKm, heading, 90, majors, shapeScale);
    if (clockwise) {
      sets.push(clockwise);
      continue;
    }
    const counter = turnLoop(start, loopKm, heading, -90, majors, shapeScale);
    if (counter) {
      sets.push(counter);
    }
  }
  appendLoopShapes(sets, start, bearingDeg, sideKm, longKm, shortKm, majors, loopKm, true);
  appendLoopShapes(sets, start, bearingDeg + 45, sideKm, longKm, shortKm, majors, loopKm, true);
  appendLoopShapes(sets, start, 0, sideKm, longKm, shortKm, majors, loopKm, false);
  return dedupeWaypointSets(sets);
}

export function snapLimitMeters(loopKm: number): number {
  const radiusM = (loopKm / (2 * Math.PI)) * 1000;
  return Math.min(1500, Math.max(300, radiusM * 0.35));
}

export function radiusScaleFromLengths(lengthsKm: number[], targetKm: number): number {
  const ratios = lengthsKm.filter((value) => value > 0).map((value) => value / targetKm);
  if (ratios.length === 0 || !(targetKm > 0)) {
    return 1;
  }
  ratios.sort((left, right) => left - right);
  const median = ratios[Math.floor(ratios.length / 2)];
  if (!(median > 0)) {
    return 1;
  }
  return Math.min(2.2, Math.max(0.6, 1 / median));
}

export function sampleRoute(coordinates: LatLon[], spacingMeters: number, limit: number): LatLon[] {
  if (coordinates.length === 0) {
    return [];
  }
  const samples = [coordinates[0]];
  let walked = 0;
  let nextAt = spacingMeters;
  for (let index = 1; index < coordinates.length; index += 1) {
    const step = distanceKm(
      coordinates[index - 1].lat,
      coordinates[index - 1].lon,
      coordinates[index].lat,
      coordinates[index].lon,
    ) * 1000;
    walked += step;
    if (walked >= nextAt) {
      samples.push(coordinates[index]);
      nextAt += spacingMeters;
      if (samples.length >= limit - 1) {
        break;
      }
    }
  }
  const last = coordinates[coordinates.length - 1];
  const tail = samples[samples.length - 1];
  if (tail.lat !== last.lat || tail.lon !== last.lon) {
    samples.push(last);
  }
  return samples.slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

export function parseOsrmRoute(payload: unknown): { distanceKm: number; coordinates: LatLon[] } | null {
  if (!isRecord(payload) || payload.code !== "Ok" || !Array.isArray(payload.routes) || payload.routes.length === 0) {
    return null;
  }
  const route = payload.routes[0];
  if (!isRecord(route) || typeof route.distance !== "number" || !isRecord(route.geometry)) {
    return null;
  }
  const raw = route.geometry.coordinates;
  if (!Array.isArray(raw)) {
    return null;
  }
  const coordinates: LatLon[] = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number") {
      continue;
    }
    coordinates.push({ lon: pair[0], lat: pair[1] });
  }
  if (coordinates.length < 2) {
    return null;
  }
  return { distanceKm: route.distance / 1000, coordinates };
}

function closeEnough(left: LatLon, right: LatLon): boolean {
  return distanceKm(left.lat, left.lon, right.lat, right.lon) * 1000 < 3;
}

function assembleRings(lines: LatLon[][]): LatLon[][] {
  const pending = lines.filter((line) => line.length >= 2).map((line) => line.map((point) => ({ ...point })));
  const rings: LatLon[][] = [];
  while (pending.length > 0) {
    const ring = pending.shift();
    if (ring == null) {
      break;
    }
    while (!closeEnough(ring[0], ring[ring.length - 1])) {
      const end = ring[ring.length - 1];
      const index = pending.findIndex((line) => closeEnough(line[0], end) || closeEnough(line[line.length - 1], end));
      if (index < 0) {
        break;
      }
      const next = pending.splice(index, 1)[0];
      if (closeEnough(next[next.length - 1], end)) {
        next.reverse();
      }
      ring.push(...next.slice(1));
    }
    if (ring.length >= 4 && closeEnough(ring[0], ring[ring.length - 1])) {
      rings.push(ring);
    }
  }
  return rings;
}

function geometryOf(value: unknown): LatLon[] {
  if (!isRecord(value) || !Array.isArray(value.geometry)) {
    return [];
  }
  return value.geometry.flatMap((node) => {
    if (!isRecord(node) || typeof node.lat !== "number" || typeof node.lon !== "number") {
      return [];
    }
    return [{ lat: node.lat, lon: node.lon }];
  });
}

function readOsmTags(raw: Record<string, unknown>): OsmWayTags {
  const pick = (key: string): string | undefined => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  return {
    highway: pick("highway"),
    sidewalk: pick("sidewalk"),
    footway: pick("footway"),
    foot: pick("foot"),
    bicycle: pick("bicycle"),
    route: pick("route"),
    access: pick("access"),
    crossing: pick("crossing"),
  };
}

export function parseOverpass(payload: unknown): {
  signals: LatLon[];
  parks: LatLon[][];
  parkHoles: LatLon[][];
  waters: LatLon[][];
  majors: LatLon[][];
  roads: OsmRoad[];
} {
  const signals: LatLon[] = [];
  const parks: LatLon[][] = [];
  const parkHoles: LatLon[][] = [];
  const waters: LatLon[][] = [];
  const majors: LatLon[][] = [];
  const roads: OsmRoad[] = [];
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    return { signals, parks, parkHoles, waters, majors, roads };
  }
  for (const element of payload.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const tags = isRecord(element.tags) ? element.tags : {};
    const osmTags = readOsmTags(tags);
    if (element.type === "node") {
      const signalNode =
        osmTags.highway === "traffic_signals" ||
        osmTags.crossing === "traffic_signals" ||
        (osmTags.highway === "crossing" && osmTags.crossing === "traffic_signals");
      if (signalNode && typeof element.lat === "number" && typeof element.lon === "number") {
        signals.push({ lat: element.lat, lon: element.lon });
      }
      continue;
    }
    if (element.type === "relation" && Array.isArray(element.members)) {
      const parkArea = typeof tags.leisure === "string" || tags.landuse === "recreation_ground";
      const waterArea =
        tags.natural === "water" || typeof tags.water === "string" || tags.waterway === "riverbank";
      if (parkArea || waterArea) {
        const outers: LatLon[][] = [];
        const inners: LatLon[][] = [];
        for (const member of element.members) {
          const line = geometryOf(member);
          if (line.length < 2) {
            continue;
          }
          if (isRecord(member) && member.role === "inner") {
            inners.push(line);
          } else {
            outers.push(line);
          }
        }
        if (parkArea) {
          parks.push(...assembleRings(outers));
          parkHoles.push(...assembleRings(inners));
        }
        if (waterArea) {
          // 堀・池の外周を水域線として使い、沿道の周回を優先する
          waters.push(...assembleRings(outers));
        }
      }
      continue;
    }
    if (element.type !== "way" || !Array.isArray(element.geometry)) {
      continue;
    }
    const ring = element.geometry.flatMap((node) => {
      if (!isRecord(node) || typeof node.lat !== "number" || typeof node.lon !== "number") {
        return [];
      }
      return [{ lat: node.lat, lon: node.lon }];
    });
    if (ring.length < 2) {
      continue;
    }
    if (typeof osmTags.highway === "string" && osmTags.highway.length > 0 && !isExcludedRoad(osmTags)) {
      roads.push({ coordinates: ring, highway: osmTags.highway, tags: osmTags });
    }
    if (typeof osmTags.highway === "string" && MAJOR_HIGHWAY.test(osmTags.highway)) {
      majors.push(ring);
    }
    if (typeof tags.leisure === "string" || tags.landuse === "recreation_ground") {
      parks.push(ring);
    } else if (
      typeof tags.waterway === "string" ||
      tags.natural === "water" ||
      typeof tags.water === "string"
    ) {
      waters.push(ring);
    }
  }
  return { signals, parks, parkHoles, waters, majors, roads };
}

export function parseElevations(payload: unknown): number[] {
  if (!isRecord(payload) || !Array.isArray(payload.elevation)) {
    return [];
  }
  return payload.elevation.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}
