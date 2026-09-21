import { describe, expect, it } from "vitest";
import { parseForecastColumns, visibleForecastCount } from "../lib/forecastColumns";

describe("forecastColumns", () => {
  it("全部オフの保存は初期値に戻す", () => {
    const parsed = parseForecastColumns(
      JSON.stringify({
        weather: false,
        feel: false,
        wbgt: false,
        temperature: false,
        humidity: false,
        wind: false,
        solar: false,
      }),
    );
    expect(visibleForecastCount(parsed)).toBe(7);
  });

  it("一部だけ残せる", () => {
    const parsed = parseForecastColumns(JSON.stringify({ weather: true, feel: false, wbgt: false }));
    expect(parsed.weather).toBe(true);
    expect(parsed.feel).toBe(false);
    expect(visibleForecastCount(parsed)).toBeGreaterThanOrEqual(1);
  });
});
