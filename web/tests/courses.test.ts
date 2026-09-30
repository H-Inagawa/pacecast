import { describe, expect, it } from "vitest";
import {
  acceptCourseDistance,
  circleWaypoints,
  courseScore,
  courseScoreParts,
  courseSearchLabel,
  courseSearchPercent,
  relativeCourseScores,
  countNearRoute,
  destinationPoint,
  elevationChange,
  featureLengthKm,
  dropRetraces,
  isParkOrRiverbank,
  keepCourseDistance,
  MAP_SERVICE_MESSAGE,
  loopWaypointSets,
  majorIntersections,
  nearestOnLines,
  orderLoopVias,
  overlapRatio,
  pickIntersectionVias,
  routeLengthKm,
  parseElevations,
  retraceMeters,
  parseOsrmRoute,
  parseOverpass,
  shouldRetryMapService,
  turnCount,
} from "../lib/courses";

const start = { lat: 35.735, lon: 139.65 };

describe("周回コースの計算", () => {
  it("希望距離の円周に中間点を置く", () => {
    const points = circleWaypoints(start, 6.28, 0, 1, 4);
    expect(points).toHaveLength(4);
    const radius = routeLengthKm([start, points[0]]);
    expect(radius).toBeGreaterThan(0.9);
    expect(radius).toBeLessThan(1.1);
  });

  it("実距離は指定の±20%かつ±2kmまで残す", () => {
    expect(acceptCourseDistance(9.1, 10)).toBe(true);
    expect(acceptCourseDistance(8.5, 10)).toBe(true);
    expect(acceptCourseDistance(7.9, 10)).toBe(false);
    expect(acceptCourseDistance(6, 5)).toBe(true);
    expect(acceptCourseDistance(6.1, 5)).toBe(false);
    expect(acceptCourseDistance(12, 10)).toBe(true);
    expect(acceptCourseDistance(12.1, 10)).toBe(false);
    expect(acceptCourseDistance(6, 5)).toBe(true);
    expect(acceptCourseDistance(6.1, 5)).toBe(false);
    expect(acceptCourseDistance(22, 20)).toBe(true);
    expect(acceptCourseDistance(23, 20)).toBe(false);
    expect(acceptCourseDistance(17, 20)).toBe(false);
    expect(keepCourseDistance(6.4, 5)).toBe(true);
    expect(keepCourseDistance(6.8, 5)).toBe(false);
  });

  it("大きく曲がった頂点だけを曲がり角にする", () => {
    const route = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.736, lon: 139.65 },
      { lat: 35.736, lon: 139.6512 },
    ];
    expect(turnCount(route)).toBe(1);
    expect(turnCount([route[0], route[1], { lat: 35.737, lon: 139.65 }])).toBe(0);
  });

  it("経路の近くの信号だけ数える", () => {
    const route = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.736, lon: 139.65 },
    ];
    const near = { lat: 35.7355, lon: 139.65005 };
    const far = { lat: 35.74, lon: 139.66 };
    expect(countNearRoute(route, [near, far], 20)).toBe(1);
  });

  it("公園の中と川の近くの距離を合わせる", () => {
    const route = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.7354, lon: 139.65 },
    ];
    const park = [
      { lat: 35.7348, lon: 139.6498 },
      { lat: 35.7348, lon: 139.6502 },
      { lat: 35.7356, lon: 139.6502 },
      { lat: 35.7356, lon: 139.6498 },
    ];
    const inside = featureLengthKm(route, [park], []);
    expect(inside).toBeGreaterThan(0);
    expect(featureLengthKm(route, [], [])).toBe(0);
  });

  it("標高の上りと下りを分ける", () => {
    expect(elevationChange([10, 12.4, 9])).toEqual({ ascentM: 2, descentM: 3 });
  });

  it("途中の往復は外し、そのままの周回は残す", () => {
    const east = (index: number) => ({ lat: 35.68, lon: 139.79 + index * 0.00055 });
    const withSpur = [
      east(0),
      east(1),
      east(2),
      east(3),
      { lat: 35.6814, lon: east(3).lon },
      { lat: 35.6828, lon: east(3).lon },
      { lat: 35.6814, lon: east(3).lon },
      east(3),
      east(4),
      east(5),
      east(6),
    ];
    const cleaned = dropRetraces(withSpur);
    expect(cleaned.some((point) => point.lat > 35.682)).toBe(false);
    expect(cleaned[0]).toEqual(east(0));
    expect(cleaned[cleaned.length - 1]).toEqual(east(6));
    const square = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.7386, lon: 139.65 },
      { lat: 35.7386, lon: 139.6544 },
      { lat: 35.735, lon: 139.6544 },
      { lat: 35.735, lon: 139.65 },
    ];
    expect(dropRetraces(square)).toHaveLength(square.length);
    expect(dropRetraces(withSpur, 18, () => true).some((point) => point.lat > 35.682)).toBe(true);
  });

  it("経由点は起点の周りを回る順にし、同じ方向は捨てる", () => {
    const start = { lat: 35.68, lon: 139.79 };
    const ordered = orderLoopVias(start, [
      { lat: 35.67, lon: 139.79 },
      { lat: 35.69, lon: 139.79 },
      { lat: 35.68, lon: 139.8 },
    ]);
    expect(ordered?.map((point) => point.lat)).toEqual([35.69, 35.68, 35.67]);
    expect(
      orderLoopVias(start, [
        { lat: 35.685, lon: 139.791 },
        { lat: 35.688, lon: 139.792 },
        { lat: 35.691, lon: 139.793 },
      ]),
    ).toBeNull();
  });

  it("同じ道を往復する経路だけ往復距離が付く", () => {
    const north = Array.from({ length: 9 }, (_, index) => ({ lat: 35.735 + index * 0.00045, lon: 139.65 }));
    const outAndBack = [...north, ...[...north].reverse().slice(1)];
    expect(retraceMeters(outAndBack)).toBeGreaterThan(120);
    const square = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.7386, lon: 139.65 },
      { lat: 35.7386, lon: 139.6544 },
      { lat: 35.735, lon: 139.6544 },
      { lat: 35.735, lon: 139.65 },
    ];
    expect(retraceMeters(square)).toBe(0);
    const river = [
      { lat: 35.734, lon: 139.65 },
      { lat: 35.74, lon: 139.65 },
    ];
    expect(retraceMeters(outAndBack, 25, 150, 400, (point) => isParkOrRiverbank(point, [], [river]))).toBe(0);
  });

  it("往復の大半は捨て、短い折り返しは残して点数を下げる材料にする", () => {
    const here = { lat: 35.68, lon: 139.7 };
    const outAndBack = [here];
    for (let step = 1; step <= 8; step += 1) {
      outAndBack.push(destinationPoint(here, 0, step * 0.08));
    }
    for (let step = 7; step >= 0; step -= 1) {
      outAndBack.push(destinationPoint(here, 0, step * 0.08));
    }
    expect(overlapRatio(outAndBack)).toBeGreaterThan(0.5);

    const north = destinationPoint(here, 0, 1.25);
    const east = destinationPoint(north, 90, 1.25);
    const south = destinationPoint(here, 90, 1.25);
    const tip = destinationPoint(north, 0, 0.4);
    const withSpur = [here, north, tip, north, east, south, here];
    expect(overlapRatio(withSpur)).toBeLessThan(0.45);
  });

  it("道の向きに加え、右45度と南北に長い長方形の目標点を置く", () => {
    const here = { lat: 35.68, lon: 139.7 };
    const sets = loopWaypointSets(here, 4, 90, [], 1);
    expect(sets.length).toBeGreaterThanOrEqual(32);
    expect(sets.length).toBeLessThanOrEqual(48);
    expect(sets.every((points) => points[0].lat === here.lat && points[0].lon === here.lon)).toBe(true);
    const firstLegs = sets.map((points) => ({
      km: routeLengthKm([points[0], points[1]]),
      lat: points[1].lat - points[0].lat,
      lon: points[1].lon - points[0].lon,
    }));
    const firstClockwise = routeLengthKm([sets[0][0], sets[0][1]]);
    expect(firstClockwise).toBeGreaterThan(0.8);
    expect(firstClockwise).toBeLessThan(1.2);
    expect(sets[0][1].lon).toBeGreaterThan(here.lon);
    expect(firstLegs.some((leg) => leg.km > 1.4 && leg.km < 1.8 && Math.abs(leg.lat) < 0.004)).toBe(true);
    expect(firstLegs.some((leg) => leg.km > 1.4 && leg.km < 1.8 && leg.lat > 0.01 && Math.abs(leg.lon) < 0.004)).toBe(true);
    expect(
      firstLegs.some((leg) => leg.km > 1.4 && leg.km < 1.8 && Math.abs(leg.lat) > 0.008 && Math.abs(leg.lon) > 0.008),
    ).toBe(true);
  });

  it("距離が近いだけの曲がりが多い案より、少しずれて曲がりが少ない案を上にする", () => {
    const shared = {
      targetKm: 4,
      majorRatio: 0.7,
      signalCount: 4,
      junctionCount: 4,
      overlapRatio: 0.02,
      meanLegMeters: 900,
      longestLegMeters: 1100,
      shortLegCount: 0,
    };
    const wiggly = courseScore({ ...shared, distanceKm: 4.01, turnCount: 15, meanLegMeters: 180, longestLegMeters: 250, shortLegCount: 8 });
    const simple = courseScore({ ...shared, distanceKm: 4.15, turnCount: 5 });
    expect(simple).toBeGreaterThan(wiggly);
    const sharedOverlap = {
      targetKm: 5,
      majorRatio: 0.7,
      turnCount: 6,
      signalCount: 4,
      junctionCount: 4,
      meanLegMeters: 900,
      longestLegMeters: 1100,
      shortLegCount: 1,
    };
    const retraced = courseScore({ ...sharedOverlap, distanceKm: 5.05, overlapRatio: 0.22 });
    const clean = courseScore({ ...sharedOverlap, distanceKm: 5.4, overlapRatio: 0.02 });
    expect(clean).toBeGreaterThan(retraced);
    const arterial = courseScore({ ...sharedOverlap, distanceKm: 5.2, majorRatio: 0.95, turnCount: 5, overlapRatio: 0.02 });
    const sideStreet = courseScore({ ...sharedOverlap, distanceKm: 5.05, majorRatio: 0.25, turnCount: 5, overlapRatio: 0.02 });
    expect(arterial).toBeGreaterThan(sideStreet);
    const fewerTurns = courseScore({ ...sharedOverlap, distanceKm: 5.3, majorRatio: 0.6, turnCount: 4, overlapRatio: 0.02 });
    const manyTurns = courseScore({ ...sharedOverlap, distanceKm: 5.05, majorRatio: 0.6, turnCount: 10, overlapRatio: 0.02 });
    expect(fewerTurns).toBeGreaterThan(manyTurns);
    const parts = courseScoreParts({ ...sharedOverlap, distanceKm: 5.2, majorRatio: 0.95, turnCount: 5, overlapRatio: 0.02 });
    expect(parts.total).toBeCloseTo(courseScore({ ...sharedOverlap, distanceKm: 5.2, majorRatio: 0.95, turnCount: 5, overlapRatio: 0.02 }));
    expect(parts.major).toBeGreaterThan(parts.turns);
    const scaled = relativeCourseScores([
      { score: 40, scoreParts: { ...parts, total: 40 } },
      { score: 20, scoreParts: { distance: 10, major: 4, straight: 2, turns: 2, overlap: 2, signals: 0, junctions: 0, total: 20 } },
    ]);
    expect(scaled[0].score).toBe(100);
    expect(scaled[1].score).toBe(50);
    expect(scaled[1].scoreParts.distance).toBe(25);
  });

  it("大通りが交わる点を3〜4点選ぶ", () => {
    const east = [
      { lat: 35.68, lon: 139.69 },
      { lat: 35.68, lon: 139.71 },
    ];
    const north = [
      { lat: 35.675, lon: 139.7 },
      { lat: 35.685, lon: 139.7 },
    ];
    const crossings = majorIntersections([east, north]);
    expect(crossings.length).toBeGreaterThan(0);
    expect(crossings[0].lat).toBeCloseTo(35.68, 3);
    expect(crossings[0].lon).toBeCloseTo(139.7, 3);
    const here = { lat: 35.68, lon: 139.7 };
    const radiusKm = 5 / (2 * Math.PI);
    const around = [0, 90, 180, 270].map((bearing) => destinationPoint(here, bearing, radiusKm));
    const sets = pickIntersectionVias(here, 5, around);
    expect(sets.length).toBeGreaterThan(0);
    expect(sets[0].length).toBeGreaterThanOrEqual(3);
    expect(sets[0].length).toBeLessThanOrEqual(4);
  });

  it("中間点は近くの大通りへ寄せる", () => {
    const road = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.736, lon: 139.65 },
    ];
    const near = nearestOnLines({ lat: 35.7355, lon: 139.65015 }, [road], 40);
    expect(near).not.toBeNull();
    expect(near?.lon).toBeCloseTo(139.65, 4);
    expect(nearestOnLines({ lat: 35.75, lon: 139.67 }, [road], 40)).toBeNull();
  });

  it("1分未満の地図サービス失敗だけ、接続を1回やり直す", () => {
    expect(shouldRetryMapService(13_000, true)).toBe(true);
    expect(shouldRetryMapService(60_000, true)).toBe(false);
    expect(shouldRetryMapService(90_000, true)).toBe(false);
    expect(shouldRetryMapService(5_000, false)).toBe(false);
    expect(MAP_SERVICE_MESSAGE).not.toContain("設定を変える必要はありません");
    expect(MAP_SERVICE_MESSAGE).toContain("\n1〜2分ほど待ってから");
    expect(courseSearchPercent(0, 0)).toBe(0);
    expect(courseSearchPercent(1, 4)).toBe(25);
    expect(courseSearchPercent(4, 4)).toBe(100);
    expect(courseSearchLabel(0)).toBe("コース検索中です...(0%)");
    expect(courseSearchLabel(25.4)).toBe("コース検索中です...(25%)");
  });

  it("ルータと地図の応答から経路と信号を読む", () => {
    expect(
      parseOsrmRoute({
        code: "Ok",
        routes: [{ distance: 2500, geometry: { coordinates: [[139.65, 35.735], [139.66, 35.736]] } }],
      }),
    ).toEqual({
      distanceKm: 2.5,
      coordinates: [
        { lon: 139.65, lat: 35.735 },
        { lon: 139.66, lat: 35.736 },
      ],
    });
    expect(parseOsrmRoute({ code: "NoRoute", routes: [] })).toBeNull();
    expect(
      parseOverpass({
        elements: [
          { type: "node", lat: 35.7, lon: 139.6, tags: { highway: "traffic_signals" } },
          {
            type: "way",
            tags: { leisure: "park" },
            geometry: [
              { lat: 1, lon: 2 },
              { lat: 1, lon: 3 },
              { lat: 2, lon: 3 },
            ],
          },
          {
            type: "way",
            tags: { waterway: "river" },
            geometry: [
              { lat: 4, lon: 5 },
              { lat: 4, lon: 6 },
            ],
          },
        ],
      }),
    ).toEqual({
      signals: [{ lat: 35.7, lon: 139.6 }],
      parks: [
        [
          { lat: 1, lon: 2 },
          { lat: 1, lon: 3 },
          { lat: 2, lon: 3 },
        ],
      ],
      waters: [
        [
          { lat: 4, lon: 5 },
          { lat: 4, lon: 6 },
        ],
      ],
      majors: [],
    });
    expect(parseElevations({ elevation: [12.5, null, 14] })).toEqual([12.5, 14]);
  });
});
