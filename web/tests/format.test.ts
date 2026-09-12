import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatPace,
  formatRunSummary,
  formatWbgtDelta,
  formatWeatherBrief,
  groupRunsByMonth,
} from "../lib/format";
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
    weather_zone: null,
    amedas_station_id: "44071",
    amedas_station_name: "練馬",
    ...partial,
  };
}

describe("format", () => {
  it("ペースを分秒/km で出す", () => {
    expect(formatPace(330)).toBe("5'30\"/km");
  });

  it("未関連の気象はプレースホルダにする", () => {
    expect(formatWeatherBrief(null)).toBe("--.-℃ / --%");
  });

  it("WBGT 付きの気象を一覧と同じ形にする", () => {
    expect(formatWeatherBrief({ temperature_c: 21, humidity_pct: 60, wbgt_c: 19.9 })).toBe(
      "21.0℃ / 60% / WBGT 19.9",
    );
  });

  it("気象距離の表示は符号付きにする", () => {
    expect(formatWbgtDelta(0.25)).toBe("+0.25");
    expect(formatWbgtDelta(-0.04)).toBe("-0.04");
    expect(formatWbgtDelta(0)).toBe("0.00");
  });

  it("日時を YYYY-MM-DD HH:mm にする", () => {
    expect(formatDateTime("2026-09-10T21:33:00")).toBe("2026-09-10 21:33");
  });

  it("走行を新しい月が上になるようまとめる", () => {
    const groups = groupRunsByMonth([
      run({ id: 1, started_at: "2026-08-01 07:00", distance_km: 5 }),
      run({ id: 2, started_at: "2026-09-10 21:33", distance_km: 5.22 }),
      run({ id: 3, started_at: "2026-09-05 21:10", distance_km: 10 }),
    ]);
    expect(groups.map((item) => item.label)).toEqual(["2026年9月", "2026年8月"]);
    expect(groups[0].runs).toHaveLength(2);
    expect(formatRunSummary(groups[0].runs.length, groups[0].total)).toBe(
      "走行件数：2件 走行距離：15.22km",
    );
  });
});
