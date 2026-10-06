import { distanceKm } from "./nearest-station";
import {
  CONNECTOR_ROAD_COST,
  CONNECTOR_TOWARD_EASY_COST,
  COURSE_DISTANCE_TOLERANCE,
  PREFER_RUN_COST,
  nearestOnLines,
  routeLengthKm,
  type LatLon,
} from "./courses";

export type NetworkWay = {
  coordinates: LatLon[];
  easy: boolean;
  /** 歩道タグ・歩行者指定・ランニングルート（探索コストを下げる） */
  preferRun?: boolean;
  /** 後方互換。preferRun と同じ */
  sidewalk?: boolean;
  /** 公園の縁・水域に近い道（昇格判定用。コストは下げない） */
  alongFeature?: boolean;
};

export type ExploredLoop = {
  coordinates: LatLon[];
  distanceKm: number;
  easyMeters: number;
  minorMeters: number;
  uturnCount: number;
  clockwiseDeg: number;
};

const NODE_DIGITS = 4;
const START_SNAP_METERS = 300;
const MIN_EDGE_METERS = 20;
const MAX_BRANCHES = 3;
/** 出発からの累積距離がこの値未満の分岐は、本数を絞り込まず全部進む（m）。 */
export const NEAR_START_FULL_BRANCH_METERS = 800;
const JOIN_METERS = 22;
const MAX_EXPANSIONS = 22000;
const MIN_EDGES = 3;
const UTURN_DEG = 150;
const SEARCH_YIELD_EVERY = 800;

export class SearchStopped extends Error {
  constructor() {
    super("検索を中止しました");
    this.name = "SearchStopped";
  }
}

async function searchPulse(signal: AbortSignal | undefined, steps: { n: number }): Promise<void> {
  steps.n += 1;
  if (signal?.aborted) {
    throw new SearchStopped();
  }
  if (steps.n % SEARCH_YIELD_EVERY !== 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  if (signal?.aborted) {
    throw new SearchStopped();
  }
}

type Directed = {
  edge: number;
  to: string;
  bearingIn: number;
  bearingOut: number;
  internalSigned: number;
  meters: number;
  easy: boolean;
  preferRun: boolean;
  coordinates: LatLon[];
};

type Frame = {
  parent: number;
  at: string;
  edge: number;
  link: number;
  heading: number;
  signed: number;
  meters: number;
  easyMeters: number;
  minorMeters: number;
  uturns: number;
  depth: number;
  preferRun: boolean;
};

function cloneWay(way: NetworkWay, coordinates: LatLon[]): NetworkWay {
  return {
    coordinates,
    easy: way.easy,
    preferRun: way.preferRun === true || way.sidewalk === true,
    sidewalk: way.preferRun === true || way.sidewalk === true,
  };
}

function nodeKey(point: LatLon): string {
  return `${point.lat.toFixed(NODE_DIGITS)},${point.lon.toFixed(NODE_DIGITS)}`;
}

function pointOf(key: string): LatLon {
  const [lat, lon] = key.split(",").map(Number);
  return { lat, lon };
}

function canonicalizer(): (point: LatLon) => string {
  const clusters: { key: string; point: LatLon }[] = [];
  const cache = new Map<string, string>();
  return (point) => {
    const raw = nodeKey(point);
    const cached = cache.get(raw);
    if (cached != null) {
      return cached;
    }
    for (const cluster of clusters) {
      if (segmentMeters(point, cluster.point) <= JOIN_METERS) {
        cache.set(raw, cluster.key);
        return cluster.key;
      }
    }
    clusters.push({ key: raw, point });
    cache.set(raw, raw);
    return raw;
  };
}

function segmentMeters(from: LatLon, to: LatLon): number {
  return distanceKm(from.lat, from.lon, to.lat, to.lon) * 1000;
}

function bearingDeg(from: LatLon, to: LatLon): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function signedTurn(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

function polylineStats(coordinates: LatLon[]): { bearingIn: number; bearingOut: number; internalSigned: number; meters: number } {
  let meters = 0;
  let bearingIn = 0;
  let bearingOut = 0;
  let internalSigned = 0;
  let previous: number | null = null;
  let started = false;
  for (let index = 1; index < coordinates.length; index += 1) {
    const step = segmentMeters(coordinates[index - 1], coordinates[index]);
    if (step < 1) {
      continue;
    }
    meters += step;
    const next = bearingDeg(coordinates[index - 1], coordinates[index]);
    if (!started) {
      bearingIn = next;
      started = true;
    } else if (previous != null && step >= 8) {
      internalSigned += signedTurn(previous, next);
    }
    if (step >= 8 || previous == null) {
      previous = next;
      bearingOut = next;
    }
  }
  return { bearingIn, bearingOut, internalSigned, meters };
}

function projectSegment(point: LatLon, start: LatLon, end: LatLon): { point: LatLon; meters: number } {
  const origin = start;
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const px = (point.lon - origin.lon) * lonScale;
  const py = (point.lat - origin.lat) * latScale;
  const ex = (end.lon - origin.lon) * lonScale;
  const ey = (end.lat - origin.lat) * latScale;
  const lengthSq = ex * ex + ey * ey;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (px * ex + py * ey) / lengthSq));
  const projected = {
    lat: start.lat + (end.lat - start.lat) * t,
    lon: start.lon + (end.lon - start.lon) * t,
  };
  return { point: projected, meters: segmentMeters(point, projected) };
}

export function nearestWayMeters(start: LatLon, ways: NetworkWay[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const way of ways) {
    for (let index = 1; index < way.coordinates.length; index += 1) {
      best = Math.min(best, projectSegment(start, way.coordinates[index - 1], way.coordinates[index]).meters);
    }
  }
  return best;
}

function sliceWay(coordinates: LatLon[], fromIndex: number, toIndex: number, splice: LatLon): LatLon[] {
  if (fromIndex < toIndex) {
    return [splice, ...coordinates.slice(fromIndex + 1, toIndex + 1)];
  }
  const reversed: LatLon[] = [splice];
  for (let index = fromIndex - 1; index >= toIndex; index -= 1) {
    reversed.push(coordinates[index]);
  }
  return reversed;
}

function openClosedRings(ways: NetworkWay[]): NetworkWay[] {
  const opened: NetworkWay[] = [];
  for (const way of ways) {
    const coordinates = way.coordinates;
    if (coordinates.length < 4 || segmentMeters(coordinates[0], coordinates[coordinates.length - 1]) > 8) {
      opened.push(way);
      continue;
    }
    const ring =
      segmentMeters(coordinates[0], coordinates[coordinates.length - 1]) < 1 ? coordinates.slice(0, -1) : coordinates.slice();
    if (ring.length < 3) {
      opened.push(way);
      continue;
    }
    const firstCut = Math.max(1, Math.floor(ring.length / 3));
    const secondCut = Math.min(ring.length - 1, Math.max(firstCut + 1, Math.floor((ring.length * 2) / 3)));
    const cuts = [0, firstCut, secondCut, ring.length];
    const pieces: NetworkWay[] = [];
    for (let index = 0; index < 3; index += 1) {
      const slice = ring.slice(cuts[index], cuts[index + 1] + (index === 2 ? 0 : 1));
      if (index === 2) {
        slice.push(ring[0]);
      }
      if (slice.length >= 2 && routeLengthKm(slice) * 1000 >= MIN_EDGE_METERS) {
        pieces.push(cloneWay(way, slice));
      }
    }
    opened.push(...(pieces.length >= 2 ? pieces : [way]));
  }
  return opened;
}

function withStartSplit(ways: NetworkWay[], start: LatLon): { ways: NetworkWay[]; startKey: string } | null {
  let bestMeters = START_SNAP_METERS;
  let best: { way: number; index: number; point: LatLon } | null = null;
  for (let way = 0; way < ways.length; way += 1) {
    const coordinates = ways[way].coordinates;
    for (let index = 1; index < coordinates.length; index += 1) {
      const projected = projectSegment(start, coordinates[index - 1], coordinates[index]);
      if (projected.meters < bestMeters) {
        bestMeters = projected.meters;
        best = { way, index, point: projected.point };
      }
    }
  }
  if (best == null) {
    return null;
  }
  const source = ways[best.way];
  const towardStart = sliceWay(source.coordinates, best.index, 0, best.point);
  const towardEnd = sliceWay(source.coordinates, best.index - 1, source.coordinates.length - 1, best.point);
  const next = ways.filter((_, index) => index !== best.way);
  for (const coordinates of [towardStart, towardEnd]) {
    if (routeLengthKm(coordinates) * 1000 >= MIN_EDGE_METERS) {
      next.push(cloneWay(source, coordinates));
    }
  }
  return { ways: next, startKey: nodeKey(best.point) };
}

function wayPreferRun(way: { preferRun?: boolean; sidewalk?: boolean }): boolean {
  return way.preferRun === true || way.sidewalk === true;
}

function metersToEasyWays(point: LatLon, easyLines: LatLon[][]): number {
  const snapped = nearestOnLines(point, easyLines, 1e9);
  if (snapped == null) {
    return Number.POSITIVE_INFINITY;
  }
  return distanceKm(point.lat, point.lon, snapped.lat, snapped.lon) * 1000;
}

function branchRank(
  heading: number | null,
  nextBearing: number,
  easy: boolean,
  preferRun: boolean,
  random: number,
  minorPenalty: number,
): number {
  const turn = heading == null ? 0 : signedTurn(heading, nextBearing);
  let rank = easy ? 0 : minorPenalty;
  if (preferRun) {
    rank -= 8;
  }
  // 直進を優先。Uターンは大きく罰する（これまでの曲がりと同じ向きの優遇はしない）
  if (Math.abs(turn) < 35) {
    rank -= 12;
  }
  if (Math.abs(turn) >= UTURN_DEG) {
    rank += 36;
  }
  return rank + random * 5;
}

function usedEdges(frames: Frame[], index: number): Set<number> {
  const used = new Set<number>();
  let cursor = index;
  while (cursor >= 0) {
    const frame = frames[cursor];
    if (frame.edge >= 0) {
      used.add(frame.edge);
    }
    cursor = frame.parent;
  }
  return used;
}

function traceCoordinates(frames: Frame[], index: number, links: Directed[]): LatLon[] {
  const steps: Directed[] = [];
  let cursor = index;
  while (cursor >= 0) {
    const frame = frames[cursor];
    if (frame.link >= 0) {
      steps.push(links[frame.link]);
    }
    cursor = frame.parent;
  }
  steps.reverse();
  const coordinates: LatLon[] = [];
  for (const step of steps) {
    const chunk = step.edge >= 0 ? step.coordinates : [];
    for (const point of chunk) {
      const previous = coordinates[coordinates.length - 1];
      if (previous != null && segmentMeters(previous, point) < 1) {
        continue;
      }
      coordinates.push(point);
    }
  }
  return coordinates;
}

function buildDirected(
  ways: NetworkWay[],
  start: LatLon,
): { links: Directed[]; out: Map<string, number[]>; startKey: string } | null {
  const placed = withStartSplit(openClosedRings(ways), start);
  if (placed == null) {
    return null;
  }
  const canon = canonicalizer();
  const startKey = canon(pointOf(placed.startKey));
  const links: Directed[] = [];
  const out = new Map<string, number[]>();
  placed.ways.forEach((way, index) => {
    const stats = polylineStats(way.coordinates);
    if (stats.meters < MIN_EDGE_METERS || way.coordinates.length < 2) {
      return;
    }
    const from = canon(way.coordinates[0]);
    const to = canon(way.coordinates[way.coordinates.length - 1]);
    if (from === to) {
      return;
    }
    const preferRun = wayPreferRun(way);
    const forward: Directed = {
      edge: index,
      to,
      bearingIn: stats.bearingIn,
      bearingOut: stats.bearingOut,
      internalSigned: stats.internalSigned,
      meters: stats.meters,
      easy: way.easy,
      preferRun,
      coordinates: way.coordinates,
    };
    const backward: Directed = {
      edge: index,
      to: from,
      bearingIn: (stats.bearingOut + 180) % 360,
      bearingOut: (stats.bearingIn + 180) % 360,
      internalSigned: -stats.internalSigned,
      meters: stats.meters,
      easy: way.easy,
      preferRun,
      coordinates: [...way.coordinates].reverse(),
    };
    const forwardIndex = links.length;
    links.push(forward);
    const backwardIndex = links.length;
    links.push(backward);
    const fromList = out.get(from) ?? [];
    fromList.push(forwardIndex);
    out.set(from, fromList);
    const toList = out.get(to) ?? [];
    toList.push(backwardIndex);
    out.set(to, toList);
  });
  if ((out.get(startKey) ?? []).length === 0) {
    return null;
  }
  return { links, out, startKey };
}

type Reach = { dist: number; real: number; prev: string | null; link: number; root: number };

function joinParts(parts: LatLon[][]): LatLon[] {
  const coordinates: LatLon[] = [];
  for (const part of parts) {
    for (const point of part) {
      const previous = coordinates[coordinates.length - 1];
      if (previous != null && segmentMeters(previous, point) < 1) {
        continue;
      }
      coordinates.push(point);
    }
  }
  return coordinates;
}

function pathParts(best: Map<string, Reach>, node: string, links: Directed[]): LatLon[][] {
  const parts: LatLon[][] = [];
  let cursor: string | null = node;
  const guard = new Set<string>();
  while (cursor != null && !guard.has(cursor)) {
    guard.add(cursor);
    const info = best.get(cursor);
    if (info == null || info.prev == null || info.link < 0) {
      break;
    }
    parts.push(links[info.link].coordinates);
    cursor = info.prev;
  }
  return parts.reverse();
}

function bearingBlocked(bearing: number, blockedBearings: number[]): boolean {
  return blockedBearings.some((blocked) => Math.abs(signedTurn(blocked, bearing)) < 40);
}

/**
 * 周回が出発点を離れる向き。往路と復路の両方を返す。
 * @param start 出発点
 * @param coordinates 周回の点列
 * @returns 出発点に接する辺の進行方向（度）
 */
export function departureBearings(start: LatLon, coordinates: LatLon[]): number[] {
  const bearings: number[] = [];
  for (let index = 1; index < coordinates.length; index += 1) {
    const step = segmentMeters(coordinates[index - 1], coordinates[index]);
    if (step < 15 || segmentMeters(start, coordinates[index - 1]) > 35) {
      continue;
    }
    bearings.push(bearingDeg(coordinates[index - 1], coordinates[index]));
  }
  return bearings;
}

/**
 * 出発点から見て、周回が最も遠くまで進んだ向きを8方位に分ける。
 * @param start 出発点
 * @param coordinates 周回の点列
 * @returns 0から7。45度刻みで、北から時計回りに近い方位
 */
export function loopTravelSector(start: LatLon, coordinates: LatLon[]): number {
  let far = coordinates[0] ?? start;
  let best = 0;
  for (const point of coordinates) {
    const meters = segmentMeters(start, point);
    if (meters > best) {
      best = meters;
      far = point;
    }
  }
  const bearing = (bearingDeg(start, far) + 360) % 360;
  return Math.round(bearing / 45) % 8;
}

/**
 * 出発点から見て、指定距離の周回で遠ざかりそうな公園・水域の方位（0〜7）。
 * @param start 出発点
 * @param targetKm 指定距離（km）
 * @param parks 公園の外周
 * @param waters 河川・堀などの線
 * @param limit 返す方位の上限
 * @returns 多い順の方位
 */
export function featurePreferSectors(
  start: LatLon,
  targetKm: number,
  parks: LatLon[][],
  waters: LatLon[][],
  limit = 2,
): number[] {
  if (!(targetKm > 0) || limit <= 0) {
    return [];
  }
  const minMeters = targetKm * 1000 * 0.22;
  const maxMeters = targetKm * 1000 * 0.55;
  const counts = new Map<number, number>();
  const tally = (point: LatLon) => {
    const away = segmentMeters(start, point);
    if (away < minMeters || away > maxMeters) {
      return;
    }
    const sector = Math.round(bearingDeg(start, point) / 45) % 8;
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  };
  for (const ring of parks) {
    for (let index = 0; index < ring.length; index += Math.max(1, Math.floor(ring.length / 24))) {
      tally(ring[index]);
    }
  }
  for (const line of waters) {
    for (let index = 0; index < line.length; index += Math.max(1, Math.floor(line.length / 16))) {
      tally(line[index]);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, limit)
    .map(([sector]) => sector);
}

function sectorGap(left: number, right: number): number {
  const diff = Math.abs(left - right) % 8;
  return Math.min(diff, 8 - diff);
}

function edgeSector(start: LatLon, coordinates: LatLon[]): number {
  const mid = coordinates[Math.floor(coordinates.length / 2)] ?? coordinates[0];
  return loopTravelSector(start, [start, mid]);
}

function spreadCandidates<T extends { meters: number; sector: number }>(candidates: T[], targetMeters: number, limit: number): T[] {
  const bySector = new Map<number, T[]>();
  for (const candidate of candidates) {
    const list = bySector.get(candidate.sector) ?? [];
    list.push(candidate);
    bySector.set(candidate.sector, list);
  }
  for (const list of bySector.values()) {
    list.sort((left, right) => Math.abs(left.meters - targetMeters) - Math.abs(right.meters - targetMeters));
  }
  const sectors = [...bySector.keys()].sort((left, right) => left - right);
  const ordered: T[] = [];
  for (let round = 0; ordered.length < limit; round += 1) {
    let added = false;
    for (const sector of sectors) {
      const item = bySector.get(sector)?.[round];
      if (item == null) {
        continue;
      }
      ordered.push(item);
      added = true;
      if (ordered.length >= limit) {
        break;
      }
    }
    if (!added) {
      break;
    }
  }
  return ordered;
}

/**
 * 出発点から別々の道へ進み、途中の道でつないで指定距離の周回を作る。
 * 分岐探索で閉じない道路網でも、一筆で戻れる周回を返す。
 * @param start 出発点
 * @param targetKm 指定距離（km）
 * @param ways 走れる道。easy は大きい範囲の道・横断・水域際・公園の縁など
 * @param limit 返す周回の上限
 * @param blockedBearings 出発点から進まない向き（度）。空なら全方位
 * @param preferSector 優先する方位。0から7。指定すると、その向きの道を遠くまでたどる
 * @param onOutside 距離の許容外で、指定距離に最も近い周回ができたときに呼ぶ
 * @param signal 中止されたときに探索を打ち切る
 * @returns 閉じた周回。距離は指定の±20%の内側
 */
export async function returnToStartLoops(
  start: LatLon,
  targetKm: number,
  ways: NetworkWay[],
  limit = 8,
  blockedBearings: number[] = [],
  preferSector: number | null = null,
  onOutside?: (loop: ExploredLoop) => void,
  signal?: AbortSignal,
): Promise<ExploredLoop[]> {
  if (!(targetKm > 0) || ways.length === 0 || limit <= 0) {
    return [];
  }
  const built = buildDirected(ways, start);
  if (built == null) {
    return [];
  }
  const { links, out, startKey } = built;
  const easyLines = ways.filter((way) => way.easy).map((way) => way.coordinates);
  const easyDist = new Map<string, number>();
  for (const node of out.keys()) {
    easyDist.set(node, metersToEasyWays(pointOf(node), easyLines));
  }
  const minMeters = targetKm * 1000 * (1 - COURSE_DISTANCE_TOLERANCE);
  const maxMeters = targetKm * 1000 * (1 + COURSE_DISTANCE_TOLERANCE);
  const best = new Map<string, Reach>([[startKey, { dist: 0, real: 0, prev: null, link: -1, root: -1 }]]);
  const heap: { node: string; dist: number }[] = [{ node: startKey, dist: 0 }];
  const steps = { n: 0 };
  const push = (item: { node: string; dist: number }) => {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].dist <= heap[index].dist) {
        break;
      }
      const swap = heap[parent];
      heap[parent] = heap[index];
      heap[index] = swap;
      index = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last != null) {
      heap[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && heap[left].dist < heap[smallest].dist) {
          smallest = left;
        }
        if (right < heap.length && heap[right].dist < heap[smallest].dist) {
          smallest = right;
        }
        if (smallest === index) {
          break;
        }
        const swap = heap[smallest];
        heap[smallest] = heap[index];
        heap[index] = swap;
        index = smallest;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    await searchPulse(signal, steps);
    const current = pop();
    const at = best.get(current.node);
    if (at == null || current.dist > at.dist + 0.5) {
      continue;
    }
    for (const linkIndex of out.get(current.node) ?? []) {
      const link = links[linkIndex];
      if (at.root < 0 && bearingBlocked(link.bearingIn, blockedBearings)) {
        continue;
      }
      const prefer = preferSector == null ? 1 : sectorGap(edgeSector(start, link.coordinates), preferSector) <= 1 ? 1 : 2;
      const fromEasy = easyDist.get(current.node) ?? Number.POSITIVE_INFINITY;
      const toEasy = easyDist.get(link.to) ?? Number.POSITIVE_INFINITY;
      const towardEasy = toEasy + 1 < fromEasy;
      const roadBias = link.easy
        ? link.preferRun
          ? PREFER_RUN_COST
          : 1
        : towardEasy
          ? CONNECTOR_TOWARD_EASY_COST
          : CONNECTOR_ROAD_COST;
      const nextDist = at.dist + link.meters * prefer * roadBias;
      const nextReal = at.real + link.meters;
      if (nextReal > maxMeters) {
        continue;
      }
      const known = best.get(link.to);
      if (known != null && known.dist <= nextDist) {
        continue;
      }
      const root = at.root < 0 ? link.edge : at.root;
      best.set(link.to, { dist: nextDist, real: nextReal, prev: current.node, link: linkIndex, root });
      push({ node: link.to, dist: nextDist });
    }
  }

  const seen = new Set<string>();
  const found: ExploredLoop[] = [];
  const candidates: { meters: number; from: string; to: string; link: number; sector: number }[] = [];
  let nearestOutside: { meters: number; from: string; to: string; link: number } | null = null;
  const targetMeters = targetKm * 1000;
  for (const [from, indexes] of out) {
    const left = best.get(from);
    if (left == null || left.root < 0) {
      continue;
    }
    for (const linkIndex of indexes) {
      const link = links[linkIndex];
      const right = best.get(link.to);
      if (right == null || right.root < 0 || left.root === right.root || link.edge === left.root || link.edge === right.root) {
        continue;
      }
      const meters = left.real + link.meters + right.real;
      if (!(meters > 0)) {
        continue;
      }
      if (meters < minMeters || meters > maxMeters) {
        const nearer =
          nearestOutside == null || Math.abs(meters - targetMeters) < Math.abs(nearestOutside.meters - targetMeters);
        if (onOutside && nearer) {
          nearestOutside = { meters, from, to: link.to, link: linkIndex };
        }
        continue;
      }
      const mid = link.coordinates[Math.floor(link.coordinates.length / 2)] ?? link.coordinates[0];
      const key = `${Math.min(left.root, right.root)}:${Math.max(left.root, right.root)}:${mid.lat.toFixed(3)}:${mid.lon.toFixed(3)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      candidates.push({ meters, from, to: link.to, link: linkIndex, sector: loopTravelSector(start, [start, mid]) });
    }
  }
  const varied = spreadCandidates(candidates, targetKm * 1000, Math.max(limit, 8));
  const materialize = (candidate: { from: string; to: string; link: number }): ExploredLoop | null => {
    const chord = links[candidate.link];
    const coordinates = joinParts([
      ...pathParts(best, candidate.from, links),
      chord.coordinates,
      ...pathParts(best, candidate.to, links).reverse().map((part) => [...part].reverse()),
    ]);
    if (coordinates.length < 4) {
      return null;
    }
    const last = coordinates[coordinates.length - 1];
    const closed = segmentMeters(last, coordinates[0]) < 1 ? coordinates : [...coordinates, coordinates[0]];
    const distance = routeLengthKm(closed);
    if (!Number.isFinite(distance) || !(distance > 0)) {
      return null;
    }
    let easyMeters = 0;
    let minorMeters = 0;
    let uturns = 0;
    let signed = 0;
    let heading: number | null = null;
    for (const part of [candidate.from, candidate.to]) {
      let cursor: string | null = part;
      const guard = new Set<string>();
      while (cursor != null && !guard.has(cursor)) {
        guard.add(cursor);
        const info = best.get(cursor);
        if (info == null || info.link < 0) {
          break;
        }
        const link = links[info.link];
        if (link.easy) {
          easyMeters += link.meters;
        } else {
          minorMeters += link.meters;
        }
        cursor = info.prev;
      }
    }
    if (chord.easy) {
      easyMeters += chord.meters;
    } else {
      minorMeters += chord.meters;
    }
    for (let index = 1; index < closed.length; index += 1) {
      const step = segmentMeters(closed[index - 1], closed[index]);
      if (step < 8) {
        continue;
      }
      const next = bearingDeg(closed[index - 1], closed[index]);
      if (heading != null) {
        const turn = signedTurn(heading, next);
        signed += turn;
        if (Math.abs(turn) >= UTURN_DEG) {
          uturns += 1;
        }
      }
      heading = next;
    }
    return {
      coordinates: closed,
      distanceKm: distance,
      easyMeters,
      minorMeters,
      uturnCount: uturns,
      clockwiseDeg: signed,
    };
  };
  for (const candidate of varied) {
    if (found.length >= limit) {
      break;
    }
    const loop = materialize(candidate);
    if (
      loop == null ||
      loop.distanceKm < targetKm * (1 - COURSE_DISTANCE_TOLERANCE) ||
      loop.distanceKm > targetKm * (1 + COURSE_DISTANCE_TOLERANCE)
    ) {
      continue;
    }
    found.push(loop);
  }
  if (nearestOutside != null && onOutside) {
    const outside = materialize(nearestOutside);
    if (
      outside != null &&
      (outside.distanceKm < targetKm * (1 - COURSE_DISTANCE_TOLERANCE) ||
        outside.distanceKm > targetKm * (1 + COURSE_DISTANCE_TOLERANCE))
    ) {
      onOutside(outside);
    }
  }
  return found;
}

/**
 * 指定した向きへ道なりに出て、使っていない道で出発点へ戻る周回を1本作る。
 * @param start 出発点
 * @param targetKm 指定距離（km）
 * @param ways 走れる道。easy は大きい範囲の道・横断・水域際・公園の縁など
 * @param bearing 進みたい向き（度）。北が0、東が90
 * @returns 閉じた周回。その向きへ出られないときは null
 */
export function loopsLeavingToward(
  start: LatLon,
  targetKm: number,
  ways: NetworkWay[],
  bearing: number,
): ExploredLoop | null {
  if (!(targetKm > 0) || ways.length === 0) {
    return null;
  }
  const built = buildDirected(ways, start);
  if (built == null) {
    return null;
  }
  const { links, out, startKey } = built;
  const firstChoices = (out.get(startKey) ?? [])
    .map((linkIndex) => ({ linkIndex, gap: Math.abs(signedTurn(bearing, links[linkIndex].bearingIn)) }))
    .filter((choice) => choice.gap <= 35)
    .sort(
      (left, right) =>
        left.gap - right.gap ||
        (links[right.linkIndex].preferRun ? 1 : 0) - (links[left.linkIndex].preferRun ? 1 : 0),
    );
  if (firstChoices.length === 0) {
    return null;
  }
  const maxMeters = targetKm * 1000 * (1 + COURSE_DISTANCE_TOLERANCE);
  const goal = targetKm * 1000 * 0.45;
  let node = startKey;
  let meters = 0;
  let easyMeters = 0;
  let minorMeters = 0;
  const used = new Set<number>();
  const outbound: LatLon[][] = [];
  for (let guard = 0; guard < 80 && meters < goal; guard += 1) {
    const choices = (out.get(node) ?? [])
      .filter((linkIndex) => !used.has(links[linkIndex].edge))
      .map((linkIndex) => ({ linkIndex, gap: Math.abs(signedTurn(bearing, links[linkIndex].bearingIn)) }))
      .filter((choice) => choice.gap <= 70)
      .sort(
        (left, right) =>
          left.gap - right.gap ||
          (links[right.linkIndex].preferRun ? 1 : 0) - (links[left.linkIndex].preferRun ? 1 : 0) ||
          (links[right.linkIndex].easy ? 1 : 0) - (links[left.linkIndex].easy ? 1 : 0),
      );
    if (choices.length === 0) {
      break;
    }
    const link = links[choices[0].linkIndex];
    if (meters + link.meters > maxMeters * 0.7 && meters > 0) {
      break;
    }
    used.add(link.edge);
    outbound.push(link.coordinates);
    meters += link.meters;
    if (link.easy) {
      easyMeters += link.meters;
    } else {
      minorMeters += link.meters;
    }
    node = link.to;
    if (meters >= goal) {
      break;
    }
  }
  if (outbound.length === 0 || meters < targetKm * 1000 * 0.25) {
    return null;
  }
  const back = pathBack(links, out, node, startKey, used, maxMeters - meters);
  if (back == null) {
    return null;
  }
  const coordinates = joinParts([...outbound, ...back.parts]);
  if (coordinates.length < 4) {
    return null;
  }
  const last = coordinates[coordinates.length - 1];
  const closed = segmentMeters(last, coordinates[0]) < 1 ? coordinates : [...coordinates, coordinates[0]];
  const distance = routeLengthKm(closed);
  if (distance < targetKm * (1 - COURSE_DISTANCE_TOLERANCE) || distance > targetKm * (1 + COURSE_DISTANCE_TOLERANCE)) {
    return null;
  }
  let signed = 0;
  let uturns = 0;
  let heading: number | null = null;
  for (let index = 1; index < closed.length; index += 1) {
    const step = segmentMeters(closed[index - 1], closed[index]);
    if (step < 8) {
      continue;
    }
    const next = bearingDeg(closed[index - 1], closed[index]);
    if (heading != null) {
      const turn = signedTurn(heading, next);
      signed += turn;
      if (Math.abs(turn) >= UTURN_DEG) {
        uturns += 1;
      }
    }
    heading = next;
  }
  return {
    coordinates: closed,
    distanceKm: distance,
    easyMeters: easyMeters + back.easyMeters,
    minorMeters: minorMeters + back.minorMeters,
    uturnCount: uturns,
    clockwiseDeg: signed,
  };
}

function pathBack(
  links: Directed[],
  out: Map<string, number[]>,
  from: string,
  startKey: string,
  used: Set<number>,
  budget: number,
): { parts: LatLon[][]; easyMeters: number; minorMeters: number } | null {
  const best = new Map<string, Reach>([[from, { dist: 0, real: 0, prev: null, link: -1, root: -1 }]]);
  const heap: { node: string; dist: number }[] = [{ node: from, dist: 0 }];
  const push = (item: { node: string; dist: number }) => {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].dist <= heap[index].dist) {
        break;
      }
      const swap = heap[parent];
      heap[parent] = heap[index];
      heap[index] = swap;
      index = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last != null) {
      heap[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && heap[left].dist < heap[smallest].dist) {
          smallest = left;
        }
        if (right < heap.length && heap[right].dist < heap[smallest].dist) {
          smallest = right;
        }
        if (smallest === index) {
          break;
        }
        const swap = heap[smallest];
        heap[smallest] = heap[index];
        heap[index] = swap;
        index = smallest;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const current = pop();
    if (current.node === startKey) {
      break;
    }
    const at = best.get(current.node);
    if (at == null || current.dist > at.dist + 0.5) {
      continue;
    }
    for (const linkIndex of out.get(current.node) ?? []) {
      const link = links[linkIndex];
      if (used.has(link.edge)) {
        continue;
      }
      const nextDist = at.dist + link.meters;
      if (nextDist > budget) {
        continue;
      }
      const known = best.get(link.to);
      if (known != null && known.dist <= nextDist) {
        continue;
      }
      best.set(link.to, { dist: nextDist, real: nextDist, prev: current.node, link: linkIndex, root: at.root });
      push({ node: link.to, dist: nextDist });
    }
  }
  if (!best.has(startKey) || startKey === from) {
    return null;
  }
  const parts = pathParts(best, startKey, links);
  let easyMeters = 0;
  let minorMeters = 0;
  let cursor: string | null = startKey;
  const guard = new Set<string>();
  while (cursor != null && cursor !== from && !guard.has(cursor)) {
    guard.add(cursor);
    const info = best.get(cursor);
    if (info == null || info.link < 0) {
      break;
    }
    if (links[info.link].easy) {
      easyMeters += links[info.link].meters;
    } else {
      minorMeters += links[info.link].meters;
    }
    cursor = info.prev;
  }
  return { parts, easyMeters, minorMeters };
}

/**
 * 出発点から同じ道で進み、その先の周回をつけて、同じ道で戻る。
 * アクセスの往復は、先で分岐する周回があるときに許す。
 * @param start 出発点
 * @param targetKm 指定距離（km）
 * @param ways 出発点から歩く道。easy は大きい範囲の道・横断・水域際・公園の縁など
 * @param limit 返す周回の上限
 * @param onOutside 距離の許容外の周回ができたときに呼ぶ
 * @param signal 中止されたときに探索を打ち切る
 * @param loopWays 周回本体に使う道。省いたときは ways を使う
 * @returns アクセス路つきの周回。距離は指定の±20%の内側
 */
export async function coursesWithAccessStem(
  start: LatLon,
  targetKm: number,
  ways: NetworkWay[],
  limit = 4,
  onOutside?: (loop: ExploredLoop) => void,
  signal?: AbortSignal,
  loopWays?: NetworkWay[],
): Promise<ExploredLoop[]> {
  if (!(targetKm > 0) || ways.length === 0 || limit <= 0) {
    return [];
  }
  const built = buildDirected(ways, start);
  if (built == null) {
    return [];
  }
  const { links, out, startKey } = built;
  const loopNetwork = loopWays ?? ways;
  const offNetwork = nearestWayMeters(start, loopNetwork) > 45;
  const exits = [...(out.get(startKey) ?? [])].sort(
    (left, right) => Number(links[right].easy) - Number(links[left].easy) || links[right].meters - links[left].meters,
  );
  const found: ExploredLoop[] = [];
  const seen = new Set<number>();
  for (const firstIndex of exits) {
    if (found.length >= limit) {
      break;
    }
    const bearing = links[firstIndex].bearingIn;
    const sector = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
    if (seen.has(sector)) {
      continue;
    }
    let easyStem = 0;
    let node = startKey;
    let linkIndex = firstIndex;
    let meters = 0;
    let guard = 0;
    const parts: LatLon[][] = [];
    const stemTarget = offNetwork ? 800 : Math.min(1500, targetKm * 1000 * 0.3);
    const reached = () => nearestWayMeters(pointOf(node), loopNetwork) <= 45;
    while (guard < 14 && meters < stemTarget) {
      const link = links[linkIndex];
      if (offNetwork && link.easy && meters >= 30) {
        break;
      }
      parts.push(link.coordinates);
      meters += link.meters;
      if (link.easy) {
        easyStem += link.meters;
      }
      node = link.to;
      guard += 1;
      if (offNetwork && reached()) {
        break;
      }
      if (!offNetwork && meters >= 400) {
        break;
      }
      const next = (out.get(node) ?? [])
        .filter((index) => links[index].edge !== link.edge)
        .map((index) => ({ index, gap: Math.abs(signedTurn(bearing, links[index].bearingIn)) }))
        .filter((choice) => choice.gap <= 40)
        .sort((left, right) => left.gap - right.gap || Number(links[right.index].easy) - Number(links[left.index].easy));
      if (next.length === 0) {
        break;
      }
      linkIndex = next[0].index;
    }
    const loopKm = targetKm - (meters * 2) / 1000;
    const minStem = offNetwork ? 30 : 250;
    if (meters < minStem || loopKm < targetKm * 0.35 || (offNetwork && !reached() && nearestWayMeters(pointOf(node), loopNetwork) > 80)) {
      continue;
    }
    const branch = pointOf(node);
    const loops = await returnToStartLoops(branch, loopKm, loopNetwork, 3, [(bearing + 180) % 360], null, undefined, signal);
    const loop = loops.find((item) => Math.abs(signedTurn(bearing, bearingDeg(branch, farPoint(branch, item.coordinates)))) >= 40) ?? loops[0];
    if (loop == null) {
      continue;
    }
    const stemLine = joinParts(parts);
    const back = [...stemLine].reverse();
    const coordinates = joinParts([stemLine, loop.coordinates, back]);
    const distance = routeLengthKm(coordinates);
    const outside =
      distance < targetKm * (1 - COURSE_DISTANCE_TOLERANCE) || distance > targetKm * (1 + COURSE_DISTANCE_TOLERANCE);
    if (outside) {
      onOutside?.({
        coordinates,
        distanceKm: distance,
        easyMeters: loop.easyMeters + easyStem * 2,
        minorMeters: loop.minorMeters + (meters - easyStem) * 2,
        uturnCount: loop.uturnCount,
        clockwiseDeg: loop.clockwiseDeg,
      });
      continue;
    }
    seen.add(sector);
    found.push({
      coordinates,
      distanceKm: distance,
      easyMeters: loop.easyMeters + easyStem * 2,
      minorMeters: loop.minorMeters + (meters - easyStem) * 2,
      uturnCount: loop.uturnCount,
      clockwiseDeg: loop.clockwiseDeg,
    });
  }
  return found;
}

function farPoint(start: LatLon, coordinates: LatLon[]): LatLon {
  let far = coordinates[0] ?? start;
  let best = 0;
  for (const point of coordinates) {
    const meters = segmentMeters(start, point);
    if (meters > best) {
      best = meters;
      far = point;
    }
  }
  return far;
}

/**
 * 走りやすい道を優先し、道路の分岐を時計回りに選んで周回を探す。
 * 右折回数は固定しない。直前の道へのUターンはしない。
 * @param start 出発点
 * @param targetKm 指定距離（km）
 * @param ways 走れる道。easy は大きい範囲の道・横断・水域際・公園の縁など
 * @param limit 距離の許容内で集める上限
 * @param maxBranches 1分岐で進む候補の数（出発から約800m以降に適用。それ未満は全分岐）
 * @param onOutside 出発点へ戻ったが距離の許容外の周回を、近い順に1本だけ渡す
 * @param signal 中止されたときに探索を打ち切る
 * @returns 閉じた周回。距離は指定の±20%の内側
 */
export async function exploreClockwiseLoops(
  start: LatLon,
  targetKm: number,
  ways: NetworkWay[],
  limit = 50,
  random: () => number = Math.random,
  minorPenalty = 28,
  maxBranches = MAX_BRANCHES,
  onOutside?: (loop: ExploredLoop) => void,
  signal?: AbortSignal,
  maxExpansions = MAX_EXPANSIONS,
  nearStartMeters = NEAR_START_FULL_BRANCH_METERS,
): Promise<ExploredLoop[]> {
  if (!(targetKm > 0) || ways.length === 0 || limit <= 0) {
    return [];
  }
  const built = buildDirected(ways, start);
  if (built == null) {
    return [];
  }
  const { links, out, startKey } = built;
  const expansionCap = Math.max(1_000, Math.floor(maxExpansions));
  const fullBranchMeters = Math.max(100, nearStartMeters);

  const minMeters = targetKm * 1000 * (1 - COURSE_DISTANCE_TOLERANCE);
  const maxMeters = targetKm * 1000 * (1 + COURSE_DISTANCE_TOLERANCE);
  const frames: Frame[] = [
    {
      parent: -1,
      at: startKey,
      edge: -1,
      link: -1,
      heading: 0,
      signed: 0,
      meters: 0,
      easyMeters: 0,
      minorMeters: 0,
      uturns: 0,
      depth: 0,
      preferRun: false,
    },
  ];
  const stack = [0];
  const found: ExploredLoop[] = [];
  const seen = new Set<string>();
  let nearestOutside = Number.POSITIVE_INFINITY;
  let nearestOutsideFrame = -1;
  let expansions = 0;
  const steps = { n: 0 };

  while (stack.length > 0 && found.length < limit && expansions < expansionCap) {
    await searchPulse(signal, steps);
    const index = stack.pop() as number;
    const frame = frames[index];
    expansions += 1;
    const backHome = frame.at === startKey || segmentMeters(pointOf(frame.at), start) <= 40;
    const inBand = frame.meters >= minMeters && frame.meters <= maxMeters;
    if (frame.depth >= MIN_EDGES && backHome && !inBand && frame.meters > 0) {
      const gap = Math.abs(frame.meters - targetKm * 1000);
      if (onOutside && gap < nearestOutside) {
        nearestOutside = gap;
        nearestOutsideFrame = index;
      }
    }
    if (frame.depth >= MIN_EDGES && inBand && backHome) {
      const coordinates = traceCoordinates(frames, index, links);
      if (coordinates.length >= 4) {
        const key = coordinates.map((point) => nodeKey(point)).join("|");
        if (!seen.has(key)) {
          seen.add(key);
          const last = coordinates[coordinates.length - 1];
          const closed =
            segmentMeters(last, coordinates[0]) < 1 ? coordinates : [...coordinates, coordinates[0]];
          found.push({
            coordinates: closed,
            distanceKm: routeLengthKm(closed),
            easyMeters: frame.easyMeters,
            minorMeters: frame.minorMeters,
            uturnCount: frame.uturns,
            clockwiseDeg: frame.signed,
          });
        }
      }
      continue;
    }
    if (frame.meters > maxMeters) {
      continue;
    }
    const used = usedEdges(frames, index);
    const choices = (out.get(frame.at) ?? []).filter((linkIndex) => {
      if (used.has(links[linkIndex].edge)) {
        return false;
      }
      // 直前の道を180度引き返さない（Uターン禁止）。同じ Way の再利用は used で別途扱う。
      if (frame.depth > 0 && Math.abs(signedTurn(frame.heading, links[linkIndex].bearingIn)) >= UTURN_DEG) {
        return false;
      }
      // 行き止まりの短い突き出し（少し行ってすぐ戻る）へは入らない
      const candidate = links[linkIndex];
      if (candidate.meters <= 180) {
        const onward = (out.get(candidate.to) ?? []).some((nextIndex) => {
          if (used.has(links[nextIndex].edge) || links[nextIndex].edge === candidate.edge) {
            return false;
          }
          return Math.abs(signedTurn(candidate.bearingOut, links[nextIndex].bearingIn)) < UTURN_DEG;
        });
        if (!onward) {
          return false;
        }
      }
      return true;
    });
    const rankedAll = choices
      .map((linkIndex) => {
        const away = segmentMeters(pointOf(links[linkIndex].to), start);
        const progress = frame.meters / (targetKm * 1000);
        const returnBias = progress >= 0.45 ? away / 80 : 0;
        return {
          linkIndex,
          rank:
            branchRank(
              frame.depth === 0 ? null : frame.heading,
              links[linkIndex].bearingIn,
              links[linkIndex].easy,
              links[linkIndex].preferRun,
              random(),
              minorPenalty,
            ) + returnBias,
        };
      })
      .sort((left, right) => left.rank - right.rank);
    // 起点付近は分岐を切り捨てず、それ以降だけ上位 maxBranches 本に絞る
    const ranked = frame.meters < fullBranchMeters ? rankedAll : rankedAll.slice(0, maxBranches);
    for (let choice = ranked.length - 1; choice >= 0; choice -= 1) {
      const link = links[ranked[choice].linkIndex];
      const nextMeters = frame.meters + link.meters;
      if (nextMeters > maxMeters * 1.05 && frame.meters > 0) {
        continue;
      }
      const turn = frame.depth === 0 ? 0 : signedTurn(frame.heading, link.bearingIn);
      const child: Frame = {
        parent: index,
        at: link.to,
        edge: link.edge,
        link: ranked[choice].linkIndex,
        heading: link.bearingOut,
        signed: frame.signed + turn + link.internalSigned,
        meters: nextMeters,
        easyMeters: frame.easyMeters + (link.easy ? link.meters : 0),
        minorMeters: frame.minorMeters + (link.easy ? 0 : link.meters),
        uturns: frame.uturns,
        depth: frame.depth + 1,
        preferRun: link.preferRun,
      };
      frames.push(child);
      stack.push(frames.length - 1);
    }
  }
  if (nearestOutsideFrame >= 0 && onOutside) {
    const coordinates = traceCoordinates(frames, nearestOutsideFrame, links);
    if (coordinates.length >= 4) {
      const last = coordinates[coordinates.length - 1];
      const closed = segmentMeters(last, coordinates[0]) < 1 ? coordinates : [...coordinates, coordinates[0]];
      const frame = frames[nearestOutsideFrame];
      onOutside({
        coordinates: closed,
        distanceKm: routeLengthKm(closed),
        easyMeters: frame.easyMeters,
        minorMeters: frame.minorMeters,
        uturnCount: frame.uturns,
        clockwiseDeg: frame.signed,
      });
    }
  }
  return found;
}
