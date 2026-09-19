import { describe, expect, it } from "vitest";
import { nearestStation } from "../lib/nearest-station";
import { stationsFixture } from "./fixtures";

describe("最寄りアメダス", () => {
  it("現在地から一番近い観測所を返す", () => {
    expect(nearestStation(stationsFixture, 35.74, 139.65)?.station_id).toBe("44071");
    expect(nearestStation(stationsFixture, 35.69, 139.75)?.station_id).toBe("44132");
    expect(nearestStation(stationsFixture, 45.5, 141.9)?.station_id).toBe("11001");
    expect(nearestStation([], 35.7, 139.7)).toBeNull();
  });
});
