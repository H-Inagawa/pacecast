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

const MAJOR_HIGHWAY = /^(trunk|primary|secondary|tertiary)(_link)?$/;

export function acceptCourseDistance(
  actualKm: number,
  targetKm: number,
  tolerance = COURSE_DISTANCE_TOLERANCE,
  capKm = COURSE_DISTANCE_CAP_KM,
): boolean {
  if (!(actualKm > 0) || !(targetKm > 0)) {
    return false;
  }
  const limitKm = Math.min(targetKm * tolerance, capKm);
  return Math.abs(actualKm - targetKm) <= limitKm;
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

export function distanceWithoutRetraceKm(distanceKm: number, coordinates: LatLon[]): number {
  return Math.max(0, distanceKm - retraceMeters(coordinates) / 1000);
}

export function acceptRetracedCourse(distanceKm: number, coordinates: LatLon[], targetKm: number): boolean {
  return (
    acceptCourseDistance(distanceKm, targetKm) &&
    acceptCourseDistance(distanceWithoutRetraceKm(distanceKm, coordinates), targetKm)
  );
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

export type CourseRank = {
  majorRatio: number;
  turnCount: number;
  signalCount: number;
  featureKm: number;
};

export function compareCourses(left: CourseRank, right: CourseRank): number {
  if (left.majorRatio !== right.majorRatio) {
    return right.majorRatio - left.majorRatio;
  }
  if (left.turnCount !== right.turnCount) {
    return left.turnCount - right.turnCount;
  }
  if (left.signalCount !== right.signalCount) {
    return left.signalCount - right.signalCount;
  }
  return right.featureKm - left.featureKm;
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

export function parseOverpass(payload: unknown): {
  signals: LatLon[];
  parks: LatLon[][];
  waters: LatLon[][];
  majors: LatLon[][];
} {
  const signals: LatLon[] = [];
  const parks: LatLon[][] = [];
  const waters: LatLon[][] = [];
  const majors: LatLon[][] = [];
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    return { signals, parks, waters, majors };
  }
  for (const element of payload.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const tags = isRecord(element.tags) ? element.tags : {};
    if (element.type === "node" && tags.highway === "traffic_signals") {
      if (typeof element.lat === "number" && typeof element.lon === "number") {
        signals.push({ lat: element.lat, lon: element.lon });
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
    if (typeof tags.highway === "string" && MAJOR_HIGHWAY.test(tags.highway)) {
      majors.push(ring);
    }
    if (typeof tags.leisure === "string" || tags.landuse === "recreation_ground") {
      parks.push(ring);
    } else if (typeof tags.waterway === "string") {
      waters.push(ring);
    }
  }
  return { signals, parks, waters, majors };
}

export function parseElevations(payload: unknown): number[] {
  if (!isRecord(payload) || !Array.isArray(payload.elevation)) {
    return [];
  }
  return payload.elevation.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}
