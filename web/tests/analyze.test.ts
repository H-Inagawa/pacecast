import { describe, expect, it } from "vitest";
import { paddedRange, wbgtPacePoints } from "../lib/analyze";
import type { Run } from "../lib/types";

function run(partial: Partial<Run> & Pick<Run, "id" | "started_at" | "distance_km">): Run {
  return {
    duration_sec: 1800,
    hours: 0,
    minutes: 30,
    seconds: 0,
    avg_heart_rate: 150,
    notes: null,
    pace_sec_per_km: 360,
    weather: null,
    hr_zone: null,
    amedas_station_id: "44071",
    amedas_station_name: "練馬",
    ...partial,
  };
}

describe("analyze", () => {
  it("気象未関連と WBGT 無しの走はプロットしない", () => {
    const points = wbgtPacePoints([
      run({ id: 1, started_at: "2026-09-01 07:00", distance_km: 5, weather: null }),
      run({
        id: 2,
        started_at: "2026-09-02 07:00",
        distance_km: 5,
        pace_sec_per_km: 330,
        weather: { temperature_c: 21, humidity_pct: 60, observed_at: "2026-09-02 07:00", wbgt_c: null },
      }),
      run({
        id: 3,
        started_at: "2026-09-03 07:00",
        distance_km: 5,
        pace_sec_per_km: 340,
        weather: { temperature_c: 24, humidity_pct: 70, observed_at: "2026-09-03 07:00", wbgt_c: 22.1 },
      }),
    ]);
    expect(points).toEqual([
      { runId: 3, startedAt: "2026-09-03 07:00", wbgtC: 22.1, paceSecPerKm: 340 },
    ]);
  });

  it("値が1点のときは範囲を広げる", () => {
    expect(paddedRange([20], 4)).toEqual([18, 22]);
  });
});
