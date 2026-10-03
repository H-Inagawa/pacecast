import { describe, expect, it } from "vitest";
import {
  acceptCourseDistance,
  courseScore,
  courseScoreParts,
  courseSearchLabel,
  courseSearchPercent,
  relativeCourseScores,
  countCrossedSignals,
  countNearRoute,
  destinationPoint,
  elevationChange,
  featureLengthKm,
  dropRetraces,
  flattenLaneHops,
  cleanCourseGeometry,
  straightenShortSpikes,
  canInheritNearbySidewalk,
  hasNearbyDedicatedSidewalk,
  isConnectorRoad,
  isDedicatedSidewalk,
  isEasyRoadConsideringSidewalks,
  isTaggedCarriageway,
  isParkOrRiverbank,
  isEasyRoad,
  loopCoversBbox,
  wayAlongParkOrWater,
  COURSE_NO_START_ROAD_MESSAGE,
  courseStemSearchLimit,
  nearestStartableRoad,
  keepCourseDistance,
  MAP_SERVICE_MESSAGE,
  majorIntersections,
  nearestOnLines,
  overlapRatio,
  chooseNearMisses,
  routeLengthKm,
  parseElevations,
  retraceMeters,
  parseOsrmRoute,
  parseOverpass,
  shouldRetryMapService,
  turnCount,
  highwaySearchLevel,
} from "../lib/courses";
import {
  coursesWithAccessStem,
  departureBearings,
  exploreClockwiseLoops,
  featurePreferSectors,
  loopTravelSector,
  loopsLeavingToward,
  NEAR_START_FULL_BRANCH_METERS,
  returnToStartLoops,
} from "../lib/course-network";

const start = { lat: 35.735, lon: 139.65 };

describe("周回コースの計算", () => {
  it("希望距離の円周に中間点を置く", () => {
    const points = [
      destinationPoint(start, 0, 1),
      destinationPoint(start, 90, 1),
      destinationPoint(start, 180, 1),
    ];
    expect(points).toHaveLength(3);
    expect(routeLengthKm([start, points[0]])).toBeGreaterThan(0.9);
  });

  it("実距離は指定の±20%だけ残す", () => {
    expect(acceptCourseDistance(9.1, 10)).toBe(true);
    expect(acceptCourseDistance(8, 10)).toBe(true);
    expect(acceptCourseDistance(7.9, 10)).toBe(false);
    expect(acceptCourseDistance(12, 10)).toBe(true);
    expect(acceptCourseDistance(12.1, 10)).toBe(false);
    expect(acceptCourseDistance(6, 5)).toBe(true);
    expect(acceptCourseDistance(6.1, 5)).toBe(false);
    expect(acceptCourseDistance(24, 20)).toBe(true);
    expect(acceptCourseDistance(24.1, 20)).toBe(false);
    expect(keepCourseDistance(6, 5)).toBe(true);
    expect(keepCourseDistance(6.8, 5)).toBe(false);
    expect(
      courseScoreParts({
        distanceKm: 8.8,
        targetKm: 8,
        easyRatio: 0,
        minorRatio: 0,
        turnCount: 0,
        signalCount: 0,
        junctionCount: 0,
        overlapRatio: 0,
        meanLegMeters: 1000,
        longestLegMeters: 1000,
        shortLegCount: 0,
        clockwiseDeg: 360,
        uturnCount: 0,
      }).distance,
    ).toBeCloseTo(10, 0);
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
    const east = destinationPoint(start, 90, 0.4);
    const north = destinationPoint(east, 0, 0.3);
    const beside = destinationPoint({ lat: (start.lat + east.lat) / 2, lon: (start.lon + east.lon) / 2 }, 0, 0.012);
    expect(countCrossedSignals([start, east], [beside])).toBe(0);
    const twin = destinationPoint(east, 45, 0.008);
    expect(countCrossedSignals([start, east, north], [east, twin])).toBe(1);
    const corner = destinationPoint(start, 0, 0.25);
    const farCorner = destinationPoint(east, 0, 0.25);
    const loop = [start, east, farCorner, corner, start];
    expect(countCrossedSignals(loop, [start])).toBe(1);
    const mid = { lat: (start.lat + east.lat) / 2, lon: (start.lon + east.lon) / 2 };
    const onPath = mid;
    expect(countCrossedSignals([start, east], [onPath])).toBe(1);
    const offset = destinationPoint(mid, 0, 0.015);
    const crossRoad = [destinationPoint(offset, 180, 0.05), destinationPoint(offset, 0, 0.05)];
    const alongRoad = [destinationPoint(offset, 270, 0.05), destinationPoint(offset, 90, 0.05)];
    expect(countCrossedSignals([start, east], [offset], 20, [crossRoad])).toBe(1);
    expect(countCrossedSignals([start, east], [offset], 20, [alongRoad])).toBe(0);
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
    const footway = [
      { lat: 35.735, lon: 139.65 },
      { lat: 35.7352, lon: 139.6502 },
    ];
    const outside = [
      { lat: 35.74, lon: 139.66 },
      { lat: 35.7402, lon: 139.6602 },
    ];
    expect(isEasyRoad("footway", footway, [park], [])).toBe(true);
    expect(isEasyRoad("footway", outside, [park], [])).toBe(false);
    expect(isEasyRoad({ highway: "primary" }, outside, [], [])).toBe(false);
    expect(isEasyRoad({ highway: "primary", sidewalk: "both" }, outside, [], [])).toBe(true);
    expect(isEasyRoad({ highway: "footway", footway: "sidewalk" }, outside, [], [])).toBe(false);
    expect(isEasyRoad({ highway: "residential", foot: "yes" }, outside, [], [])).toBe(true);
    expect(isEasyRoad({ highway: "cycleway", bicycle: "designated", foot: "no" }, outside, [], [])).toBe(false);
    expect(isEasyRoad({ highway: "steps" }, outside, [], [])).toBe(false);
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

  it("短い折り返しはまっすぐな道に直し、長い往復は残す", () => {
    const east = (index: number) => ({ lat: 35.68, lon: 139.65 + index * 0.0012 });
    const bend = east(2);
    const spur = { lat: bend.lat + 0.0007, lon: bend.lon + 0.00015 };
    const spiked = [east(0), east(1), bend, spur, bend, east(3), east(4), east(5)];
    const cleaned = straightenShortSpikes(spiked);
    expect(cleaned.some((point) => point.lat > 35.6804)).toBe(false);
    expect(overlapRatio(cleaned)).toBeLessThan(overlapRatio(spiked));
    // 交差点から少し南へ出て戻るパターン（再合流点が数十mずれていても落とす）
    const junction = east(2);
    const tip = { lat: junction.lat - 0.0018, lon: junction.lon + 0.0001 };
    const rejoin = { lat: junction.lat + 0.0002, lon: junction.lon + 0.00035 };
    const outAndBack = [east(0), east(1), junction, tip, rejoin, east(3), east(4), east(5)];
    const fixed = cleanCourseGeometry(outAndBack);
    expect(fixed.some((point) => point.lat < 35.6792)).toBe(false);
    const stem = [
      { lat: 35.7, lon: 139.6 },
      { lat: 35.704, lon: 139.6 },
      { lat: 35.707, lon: 139.6 },
      { lat: 35.707, lon: 139.604 },
      { lat: 35.704, lon: 139.604 },
      { lat: 35.704, lon: 139.6 },
      { lat: 35.7, lon: 139.6 },
    ];
    expect(straightenShortSpikes(stem)).toHaveLength(stem.length);
  });

  it("車線乗り換えのような短い折れを直線に直す", () => {
    // 北東へ進みつつ、途中だけ南東へ短く飛び出す V 字（添付2の乗り換え）
    const line = [
      { lat: 35.68, lon: 139.65 },
      { lat: 35.6804, lon: 139.6504 },
      { lat: 35.6802, lon: 139.6509 },
      { lat: 35.6808, lon: 139.6509 },
      { lat: 35.6812, lon: 139.6513 },
    ];
    const hop = line[2];
    const flat = flattenLaneHops(line);
    expect(flat).toEqual([line[0], line[1], line[3], line[4]]);
    expect(flat.some((point) => Math.abs(point.lat - hop.lat) < 1e-9 && Math.abs(point.lon - hop.lon) < 1e-9)).toBe(false);
  });

  it("独立歩道は走りやすい道にせず、隣接する歩道タグ無しの車道を歩道付きとみなす", () => {
    expect(isDedicatedSidewalk({ highway: "footway", footway: "sidewalk" })).toBe(true);
    expect(isTaggedCarriageway({ highway: "primary", sidewalk: "both" })).toBe(true);
    expect(isTaggedCarriageway({ highway: "footway", footway: "sidewalk" })).toBe(false);
    expect(canInheritNearbySidewalk({ highway: "primary" })).toBe(true);
    expect(canInheritNearbySidewalk({ highway: "primary", sidewalk: "both" })).toBe(false);
    expect(canInheritNearbySidewalk({ highway: "footway", footway: "sidewalk" })).toBe(false);
    const road = [
      { lat: 35.68, lon: 139.65 },
      { lat: 35.68, lon: 139.652 },
    ];
    const sidewalk = [
      { lat: 35.6802, lon: 139.65 },
      { lat: 35.6802, lon: 139.652 },
    ];
    const far = [
      { lat: 35.69, lon: 139.65 },
      { lat: 35.69, lon: 139.652 },
    ];
    expect(hasNearbyDedicatedSidewalk(road, [sidewalk])).toBe(true);
    expect(hasNearbyDedicatedSidewalk(road, [far])).toBe(false);
    expect(isEasyRoadConsideringSidewalks({ highway: "footway", footway: "sidewalk" }, sidewalk, [], [], [], [sidewalk])).toBe(false);
    expect(isEasyRoadConsideringSidewalks({ highway: "primary" }, road, [], [], [], [sidewalk])).toBe(true);
    expect(isEasyRoadConsideringSidewalks({ highway: "primary" }, road, [], [], [], [far])).toBe(false);
    expect(isEasyRoadConsideringSidewalks({ highway: "primary", sidewalk: "both" }, road, [], [], [], [])).toBe(true);
  });

  it("生活道路は長さにかかわらず接続道路になり、歩道無しの幹線と独立歩道はならない", () => {
    const long = [
      { lat: 35.68, lon: 139.65 },
      { lat: 35.68, lon: 139.66 },
    ];
    expect(routeLengthKm(long) * 1000).toBeGreaterThan(100);
    expect(isConnectorRoad({ highway: "residential" }, long)).toBe(true);
    expect(isConnectorRoad({ highway: "living_street" }, long)).toBe(true);
    expect(isConnectorRoad({ highway: "primary" }, long)).toBe(false);
    expect(isConnectorRoad({ highway: "primary", sidewalk: "both" }, long)).toBe(false);
    expect(isConnectorRoad({ highway: "footway", footway: "sidewalk" }, long)).toBe(false);
  });

  it("大通りの四辺を時計回りにたどって出発点へ戻る", async () => {
    const here = { lat: 35.68, lon: 139.7 };
    const east = { lat: here.lat, lon: here.lon + 0.012 };
    const north = { lat: here.lat + 0.012, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const ways = [
      { coordinates: [here, east], easy: true },
      { coordinates: [east, far], easy: true },
      { coordinates: [far, north], easy: true },
      { coordinates: [north, here], easy: true },
      { coordinates: [here, { lat: here.lat, lon: here.lon + 0.003 }], easy: false },
    ];
    const targetKm = routeLengthKm([here, east, far, north, here]);
    const loops = await exploreClockwiseLoops(here, targetKm, ways, 10, () => 0);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.some((loop) => loop.clockwiseDeg > 180)).toBe(true);
    expect(loops.every((loop) => Math.abs(loop.distanceKm - targetKm) <= targetKm * 0.2)).toBe(true);
  });

  it("同じ向きの曲がりを優先して周回を拾う", async () => {
    const here = { lat: 35.74, lon: 139.64 };
    const east = { lat: here.lat, lon: here.lon + 0.011 };
    const northEast = { lat: here.lat + 0.011, lon: here.lon + 0.011 };
    const north = { lat: here.lat + 0.011, lon: here.lon };
    // 南へ出て東へ行き east に戻る枝は、最初の右折のあと左折が必要になりロリポップ寄り
    const south = { lat: here.lat - 0.008, lon: here.lon };
    const southEast = { lat: here.lat - 0.008, lon: here.lon + 0.011 };
    const ways = [
      { coordinates: [here, east], easy: true },
      { coordinates: [east, northEast], easy: true },
      { coordinates: [northEast, north], easy: true },
      { coordinates: [north, here], easy: true },
      { coordinates: [here, south], easy: true },
      { coordinates: [south, southEast], easy: true },
      { coordinates: [southEast, east], easy: true },
    ];
    const targetKm = routeLengthKm([here, east, northEast, north, here]);
    const loops = await exploreClockwiseLoops(here, targetKm, ways, 12, () => 0);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.some((loop) => loop.clockwiseDeg > 120)).toBe(true);
  });

  it("出発から800m未満は分岐を絞り込まず探索する", async () => {
    expect(NEAR_START_FULL_BRANCH_METERS).toBe(800);
    const here = { lat: 35.74, lon: 139.64 };
    const legKm = 0.35;
    const ways: { coordinates: { lat: number; lon: number }[]; easy: boolean }[] = [];
    for (const heading of [0, 72, 144, 216, 288]) {
      const a = destinationPoint(here, heading, legKm);
      const b = destinationPoint(a, heading + 90, legKm);
      const c = destinationPoint(b, heading + 180, legKm);
      ways.push(
        { coordinates: [here, a], easy: true },
        { coordinates: [a, b], easy: true },
        { coordinates: [b, c], easy: true },
        { coordinates: [c, here], easy: true },
      );
    }
    const targetKm = legKm * 4;
    // maxBranches=3 でも起点付近は全分岐するため、4方位を超える周回が残る
    const loops = await exploreClockwiseLoops(here, targetKm, ways, 20, () => 0, 28, 3);
    expect(loops.length).toBeGreaterThan(3);
    const sectors = new Set(loops.map((loop) => loopTravelSector(here, loop.coordinates)));
    expect(sectors.size).toBeGreaterThan(3);
  });

  it("大通りの一つ下の道でも周回を閉じられる", async () => {
    expect(highwaySearchLevel("secondary")).toBe(0);
    expect(highwaySearchLevel("unclassified")).toBe(1);
    expect(highwaySearchLevel("residential")).toBe(2);
    expect(highwaySearchLevel("living_street")).toBe(3);
    expect(highwaySearchLevel("footway")).toBe(5);
    const here = { lat: 35.7, lon: 139.72 };
    const east = { lat: here.lat, lon: here.lon + 0.011 };
    const north = { lat: here.lat + 0.011, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const ways = [
      { coordinates: [here, east], easy: false },
      { coordinates: [east, far], easy: false },
      { coordinates: [far, north], easy: false },
      { coordinates: [north, here], easy: false },
    ];
    const targetKm = routeLengthKm([here, east, far, north, here]);
    const loops = await exploreClockwiseLoops(here, targetKm, ways, 10, () => 0, 6, 4);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops[0].minorMeters).toBeGreaterThan(0);
  });

  it("北と南の両方へ進む周回を返す", async () => {
    const here = { lat: 35.74, lon: 139.64 };
    const north = { lat: here.lat + 0.012, lon: here.lon };
    const east = { lat: here.lat, lon: here.lon + 0.014 };
    const northEast = { lat: north.lat, lon: east.lon };
    const south = { lat: here.lat - 0.012, lon: here.lon };
    const southEast = { lat: south.lat, lon: east.lon };
    const ways = [
      { coordinates: [here, north], easy: true },
      { coordinates: [north, northEast], easy: true },
      { coordinates: [northEast, east], easy: true },
      { coordinates: [east, here], easy: true },
      { coordinates: [here, south], easy: true },
      { coordinates: [south, southEast], easy: true },
      { coordinates: [southEast, east], easy: true },
    ];
    const targetKm = routeLengthKm([here, north, northEast, east, here]);
    const loops = await returnToStartLoops(here, targetKm, ways, 8);
    const sectors = new Set(loops.map((loop) => loopTravelSector(here, loop.coordinates)));
    expect(sectors.size).toBeGreaterThan(1);
    const northish = loops.filter((loop) => {
      const sector = loopTravelSector(here, loop.coordinates);
      return sector === 0 || sector === 1 || sector === 7;
    });
    const blocked = northish
      .flatMap((loop) => departureBearings(here, loop.coordinates))
      .filter((bearing) => {
        const turn = ((bearing + 540) % 360) - 180;
        return Math.abs(turn) < 50;
      });
    const rest = await returnToStartLoops(here, targetKm, ways, 8, blocked);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((loop) => {
      const sector = loopTravelSector(here, loop.coordinates);
      return sector !== 0 && sector !== 1 && sector !== 7;
    })).toBe(true);
    const towardSouth = loopsLeavingToward(here, targetKm, ways, 180);
    expect(towardSouth).not.toBeNull();
    expect(loopTravelSector(here, towardSouth?.coordinates ?? [])).toBeGreaterThan(1);
  });

  it("分岐探索で閉じない道でも、別の道で戻る周回を作れる", async () => {
    const here = { lat: 35.74, lon: 139.64 };
    const east = { lat: here.lat, lon: here.lon + 0.014 };
    const north = { lat: here.lat + 0.012, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const ways = [
      { coordinates: [here, east], easy: false },
      { coordinates: [east, far], easy: false },
      { coordinates: [far, north], easy: false },
      { coordinates: [north, here], easy: false },
    ];
    const targetKm = routeLengthKm([here, east, far, north, here]);
    const loops = await returnToStartLoops(here, targetKm, ways, 4);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.every((loop) => Math.abs(loop.distanceKm - targetKm) <= targetKm * 0.2)).toBe(true);
  });

  it("細い道の先からでも、短い道で走りやすい道の周回につなぐ", async () => {
    const here = { lat: 35.74, lon: 139.65 };
    const east = { lat: here.lat, lon: here.lon + 0.012 };
    const north = { lat: here.lat + 0.012, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const home = { lat: here.lat - 0.0009, lon: here.lon };
    const majors = [
      { coordinates: [here, east], easy: true },
      { coordinates: [east, far], easy: true },
      { coordinates: [far, north], easy: true },
      { coordinates: [north, here], easy: true },
    ];
    const spur = { coordinates: [home, here], easy: false };
    const squareKm = routeLengthKm([here, east, far, north, here]);
    const stemKm = routeLengthKm([home, here]);
    const loops = await coursesWithAccessStem(home, squareKm + stemKm * 2, [...majors, spur], 4, undefined, undefined, majors);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.some((loop) => loop.coordinates.some((point) => routeLengthKm([point, home]) < 0.04))).toBe(true);
    expect(loops[0].minorMeters).toBeGreaterThan(0);
  });

  it("閉じた園路でも周回に使える", async () => {
    const west = { lat: 35.74, lon: 139.65 };
    const east = { lat: 35.74, lon: 139.662 };
    const north = { lat: 35.751, lon: 139.662 };
    const south = { lat: 35.751, lon: 139.65 };
    const ring = [west, east, north, south, west];
    const loops = await returnToStartLoops(west, routeLengthKm(ring), [{ coordinates: ring, easy: true }]);
    expect(loops.length).toBeGreaterThan(0);
  });

  it("公園の縁・水域沿いの道を判定し、周回探索で優先する", async () => {
    const here = { lat: 35.74, lon: 139.64 };
    const east = { lat: here.lat, lon: here.lon + 0.014 };
    const north = { lat: here.lat + 0.012, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const midSouth = { lat: here.lat - 0.006, lon: here.lon + 0.007 };
    const water = [
      { lat: here.lat + 0.0002, lon: here.lon },
      { lat: north.lat, lon: here.lon + 0.0002 },
      { lat: far.lat + 0.0002, lon: east.lon },
      { lat: east.lat + 0.0002, lon: east.lon },
    ];
    const park = [
      { lat: here.lat + 0.001, lon: here.lon + 0.001 },
      { lat: here.lat + 0.001, lon: east.lon - 0.001 },
      { lat: far.lat - 0.001, lon: east.lon - 0.001 },
      { lat: far.lat - 0.001, lon: here.lon + 0.001 },
      { lat: here.lat + 0.001, lon: here.lon + 0.001 },
    ];
    const alongNorth = [here, north];
    const inland = [here, midSouth, east];
    expect(wayAlongParkOrWater(alongNorth, [park], [water])).toBe(true);
    expect(wayAlongParkOrWater(inland, [], [])).toBe(false);
    expect(
      loopCoversBbox(
        [here, east, far, north, here],
        { minLat: here.lat + 0.002, maxLat: far.lat - 0.002, minLon: here.lon + 0.002, maxLon: east.lon - 0.002 },
      ),
    ).toBe(true);
    const sectors = featurePreferSectors(here, 5, [park], [water], 2);
    expect(sectors.length).toBeGreaterThan(0);
    const targetKm = routeLengthKm([here, east, far, north, here]);
    const ways = [
      { coordinates: [here, east], easy: true, alongFeature: false },
      { coordinates: [east, far], easy: true, alongFeature: true },
      { coordinates: [far, north], easy: true, alongFeature: true },
      { coordinates: [north, here], easy: true, alongFeature: true },
      { coordinates: [here, midSouth], easy: true, alongFeature: false },
      { coordinates: [midSouth, east], easy: true, alongFeature: false },
    ];
    const loops = await returnToStartLoops(here, targetKm, ways, 8);
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.some((loop) => loop.coordinates.some((point) => Math.abs(point.lat - north.lat) < 0.001))).toBe(true);
  });

  it("面している細い道や公園内の通路からスタートし、遠い広場では道が無い", () => {
    const besidePath = { lat: 35.745, lon: 139.655 };
    const path = [
      { lat: 35.745, lon: 139.654 },
      { lat: 35.745, lon: 139.656 },
    ];
    const street = [
      { lat: 35.744, lon: 139.654 },
      { lat: 35.744, lon: 139.656 },
    ];
    const major = [
      { lat: 35.74, lon: 139.654 },
      { lat: 35.74, lon: 139.656 },
    ];
    const nearPath = nearestStartableRoad(besidePath, [
      { coordinates: path, highway: "footway", tags: { highway: "footway" }, easy: true },
      { coordinates: street, highway: "residential", tags: { highway: "residential" }, connector: true },
      { coordinates: major, highway: "primary", tags: { highway: "primary", sidewalk: "both" }, easy: true },
    ]);
    expect(nearPath?.point.lat).toBeCloseTo(35.745, 3);
    expect(nearPath?.meters).toBeLessThan(80);

    const besideStreet = { lat: 35.74405, lon: 139.655 };
    const nearStreet = nearestStartableRoad(besideStreet, [
      { coordinates: street, highway: "residential", tags: { highway: "residential" }, connector: true },
      { coordinates: major, highway: "primary", tags: { highway: "primary", sidewalk: "both" }, easy: true },
    ]);
    expect(nearStreet?.point.lat).toBeCloseTo(35.744, 3);

    const plaza = { lat: 35.75, lon: 139.66 };
    expect(
      nearestStartableRoad(plaza, [
        { coordinates: path, highway: "footway", tags: { highway: "footway" }, easy: true },
        { coordinates: street, highway: "residential", tags: { highway: "residential" }, connector: true },
      ]),
    ).toBeNull();
    expect(COURSE_NO_START_ROAD_MESSAGE).toMatch(/スタートできる道がありません/);
    expect(COURSE_NO_START_ROAD_MESSAGE).toMatch(/起点を道の近くに動かして/);
    expect(courseStemSearchLimit(5)).toBe(8);
    expect(courseStemSearchLimit(11)).toBe(4);
    expect(courseStemSearchLimit(17)).toBe(0);
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

  it("出発点から周回までの往復は重複に数えない", () => {
    const here = { lat: 35.74, lon: 139.64 };
    const gate = { lat: here.lat + 0.008, lon: here.lon };
    const east = { lat: gate.lat, lon: here.lon + 0.01 };
    const north = { lat: gate.lat + 0.01, lon: here.lon };
    const far = { lat: north.lat, lon: east.lon };
    const lollipop = [here, gate, east, far, north, gate, here];
    expect(overlapRatio(lollipop)).toBeLessThan(0.1);
    const outAndBack = [here, gate, north, gate, here];
    expect(overlapRatio(outAndBack)).toBeGreaterThan(0.5);
  });

  it("合格が無いときは距離ちがいと重複ちがいを1件ずつ残す", () => {
    const distanceMiss = {
      coordinates: [
        { lat: 35.74, lon: 139.64 },
        { lat: 35.75, lon: 139.64 },
        { lat: 35.75, lon: 139.65 },
        { lat: 35.74, lon: 139.64 },
      ],
    };
    const overlapMiss = {
      coordinates: [
        { lat: 35.8, lon: 139.7 },
        { lat: 35.81, lon: 139.7 },
        { lat: 35.81, lon: 139.71 },
        { lat: 35.8, lon: 139.7 },
      ],
    };
    expect(chooseNearMisses(distanceMiss, overlapMiss)).toEqual([distanceMiss, overlapMiss]);
    expect(chooseNearMisses(distanceMiss, distanceMiss)).toEqual([distanceMiss]);
    expect(chooseNearMisses(null, overlapMiss)).toEqual([overlapMiss]);
    expect(chooseNearMisses(null, null)).toEqual([]);
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

  it("走りやすい道が長く、曲がりが少ない案を上にする", () => {
    const shared = {
      targetKm: 4,
      easyRatio: 0.7,
      minorRatio: 0.1,
      signalCount: 4,
      junctionCount: 4,
      overlapRatio: 0.02,
      meanLegMeters: 900,
      longestLegMeters: 1100,
      shortLegCount: 0,
      clockwiseDeg: 360,
      uturnCount: 0,
    };
    const wiggly = courseScore({ ...shared, distanceKm: 4.01, turnCount: 12, meanLegMeters: 180, longestLegMeters: 250, shortLegCount: 8 });
    const simple = courseScore({ ...shared, distanceKm: 4.15, turnCount: 4 });
    expect(simple).toBeGreaterThan(wiggly);
    const sharedOverlap = {
      targetKm: 5,
      easyRatio: 0.7,
      minorRatio: 0.1,
      turnCount: 5,
      signalCount: 4,
      junctionCount: 4,
      meanLegMeters: 900,
      longestLegMeters: 1100,
      shortLegCount: 1,
      clockwiseDeg: 360,
      uturnCount: 0,
    };
    const retraced = courseScore({ ...sharedOverlap, distanceKm: 5.05, overlapRatio: 0.1 });
    const clean = courseScore({ ...sharedOverlap, distanceKm: 5.05, overlapRatio: 0.02 });
    expect(clean).toBeGreaterThan(retraced);
    const arterial = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.95, minorRatio: 0.05, turnCount: 5, overlapRatio: 0.02 });
    const sideStreet = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.25, minorRatio: 0.7, turnCount: 5, overlapRatio: 0.02 });
    expect(arterial).toBeGreaterThan(sideStreet);
    const fewerSignals = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.6, signalCount: 2, overlapRatio: 0.02 });
    const manySignals = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.6, signalCount: 25, overlapRatio: 0.02 });
    expect(fewerSignals).toBeGreaterThan(manySignals);
    const parts = courseScoreParts({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.95, turnCount: 5, overlapRatio: 0.02 });
    expect(parts.total).toBeCloseTo(courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.95, turnCount: 5, overlapRatio: 0.02 }));
    expect(parts.easy).toBeGreaterThan(parts.turns);
    expect(parts.clockwise).toBe(0);
    expect(parts.uturn).toBe(0);
    const lowMinor = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.9, minorRatio: 0.05, overlapRatio: 0.02 });
    const highMinor = courseScore({ ...sharedOverlap, distanceKm: 5.05, easyRatio: 0.6, minorRatio: 0.35, overlapRatio: 0.02 });
    expect(lowMinor - highMinor).toBeGreaterThan(10);
    const matched = { ...sharedOverlap, distanceKm: 5, overlapRatio: 0.02 };
    const farther = courseScore({ ...matched, distanceKm: 5.9 });
    const closer = courseScore(matched);
    expect(closer - farther).toBeGreaterThan(8);
    expect(courseScoreParts({ ...matched, overlapRatio: 0.1 }).overlap).toBe(0);
    expect(courseScoreParts({ ...matched, overlapRatio: 0.05 }).overlap).toBeGreaterThan(0);
    expect(courseScoreParts({ ...matched, overlapRatio: 0, turnCount: 5, signalCount: 0 }).turns).toBe(10);
    expect(courseScoreParts({ ...matched, turnCount: 15, signalCount: 0 }).turns).toBe(0);
    expect(courseScoreParts({ ...matched, signalCount: 0 }).signals).toBe(10);
    expect(courseScoreParts({ ...matched, turnCount: 15, signalCount: 25 }).signals).toBe(0);
    expect(courseScoreParts({ ...matched, uturnCount: 1 }).uturn).toBe(0);
    expect(courseScoreParts({ ...matched, uturnCount: 2 }).uturn).toBe(0);
    const scaled = relativeCourseScores([
      { score: 40, scoreParts: { ...parts, total: 40 } },
      {
        score: 20,
        scoreParts: {
          distance: 10,
          easy: 0,
          straight: 2,
          turns: 2,
          overlap: 6,
          signals: 0,
          clockwise: 0,
          uturn: 0,
          minor: 0,
          junctions: 0,
          total: 20,
        },
      },
    ]);
    expect(scaled[0].score).toBe(100);
    expect(scaled[0].rawScore).toBe(40);
    expect(scaled[1].score).toBe(50);
    expect(scaled[1].rawScore).toBe(20);
    expect(scaled[1].scoreParts.distance).toBe(25);
    expect(scaled[1].rawScoreParts.distance).toBe(10);
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
    expect(courseSearchLabel(0, 0)).toBe("コース検索中です...(0% / 合格ルート: 0件)");
    expect(courseSearchLabel(25.4, 4)).toBe("コース検索中です...(25% / 合格ルート: 4件)");
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
          {
            type: "way",
            tags: { natural: "water", water: "moat" },
            geometry: [
              { lat: 7, lon: 8 },
              { lat: 7, lon: 9 },
              { lat: 8, lon: 9 },
              { lat: 7, lon: 8 },
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
        [
          { lat: 7, lon: 8 },
          { lat: 7, lon: 9 },
          { lat: 8, lon: 9 },
          { lat: 7, lon: 8 },
        ],
      ],
      majors: [],
      roads: [],
      parkHoles: [],
    });
    expect(parseElevations({ elevation: [12.5, null, 14] })).toEqual([12.5, 14]);
    const splitPark = parseOverpass({
      elements: [
        {
          type: "relation",
          tags: { leisure: "park" },
          members: [
            {
              type: "way",
              role: "outer",
              geometry: [
                { lat: 35.64, lon: 139.86 },
                { lat: 35.64, lon: 139.861 },
              ],
            },
            {
              type: "way",
              role: "outer",
              geometry: [
                { lat: 35.64, lon: 139.861 },
                { lat: 35.641, lon: 139.861 },
                { lat: 35.641, lon: 139.86 },
                { lat: 35.64, lon: 139.86 },
              ],
            },
          ],
        },
      ],
    });
    expect(splitPark.parks).toHaveLength(1);
    expect(splitPark.parkHoles).toHaveLength(0);
    expect(isEasyRoad("path", [{ lat: 35.6404, lon: 139.8604 }, { lat: 35.6405, lon: 139.8605 }], splitPark.parks, [], splitPark.parkHoles)).toBe(true);
  });
});
