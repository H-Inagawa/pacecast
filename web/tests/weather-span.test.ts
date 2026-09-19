import { describe, expect, it } from "vitest";
import { estimateWbgt } from "../lib/wbgt";
import { effectiveWeather, meanNumbers, runEndedAt, shouldAverageWeatherSpan } from "../lib/weather-span";
import type { WeatherRow } from "../lib/server/types";

function weather(partial: Partial<WeatherRow> & Pick<WeatherRow, "id" | "observed_at" | "temperature_c" | "humidity_pct">): WeatherRow {
  return {
    location: "東京",
    temperature_quality: null,
    humidity_quality: null,
    wind_ms: 2,
    solar_wm2: 400,
    wbgt_c: 18,
    wbgt_method: "ono2014",
    station_id: "44132",
    source: "open-meteo",
    imported_at: partial.observed_at,
    ...partial,
  };
}

describe("長時間走の気象平均", () => {
  it("終了時刻は開始に走行時間を足す", () => {
    expect(runEndedAt(new Date("2026-09-19T07:00:00+09:00"), 7200).toISOString()).toBe(
      new Date("2026-09-19T09:00:00+09:00").toISOString(),
    );
    expect(shouldAverageWeatherSpan(3600)).toBe(false);
    expect(shouldAverageWeatherSpan(3601)).toBe(true);
  });

  it("隣の1時間値までは開始の1点のまま", () => {
    const start = weather({ id: 1, observed_at: "2026-09-19T08:00:00+09:00", temperature_c: 20, humidity_pct: 50 });
    const nextHour = weather({ id: 2, observed_at: "2026-09-19T09:00:00+09:00", temperature_c: 22, humidity_pct: 55 });
    expect(effectiveWeather(start, nextHour)?.temperature_c).toBe(20);
  });

  it("同じ観測なら開始の1点を返す", () => {
    const start = weather({ id: 1, observed_at: "2026-09-19T07:00:00+09:00", temperature_c: 20, humidity_pct: 50 });
    expect(effectiveWeather(start, start)?.temperature_c).toBe(20);
    expect(meanNumbers([20, 30])).toBe(25);
  });

  it("開始と終了が違えば気温・湿度を平均し WBGT を付け直す", () => {
    const start = weather({
      id: 1,
      observed_at: "2026-09-19T07:00:00+09:00",
      temperature_c: 20,
      humidity_pct: 40,
      wind_ms: 2,
      solar_wm2: 400,
    });
    const end = weather({
      id: 2,
      observed_at: "2026-09-19T09:00:00+09:00",
      temperature_c: 30,
      humidity_pct: 60,
      wind_ms: 2,
      solar_wm2: 400,
    });
    const averaged = effectiveWeather(start, end);
    expect(averaged?.temperature_c).toBe(25);
    expect(averaged?.humidity_pct).toBe(50);
    expect(averaged?.wbgt_c).toBeCloseTo(estimateWbgt(25, 50, 400, 2));
    expect(averaged?.observed_at).toBe(start.observed_at);
  });

  it("終了が無ければ開始のまま", () => {
    const start = weather({ id: 1, observed_at: "2026-09-19T07:00:00+09:00", temperature_c: 20, humidity_pct: 50 });
    expect(effectiveWeather(start, null)?.id).toBe(1);
    expect(effectiveWeather(null, start)).toBeNull();
  });
});
