import { describe, expect, it } from "vitest";
import { parseForecastColumns } from "../lib/forecastColumns";

describe("forecastColumns", () => {
  it("未保存は気温・湿度・風速・日照を出さない", () => {
    const parsed = parseForecastColumns(null);
    expect(parsed).toEqual({
      temperature: false,
      humidity: false,
      wind: false,
      solar: false,
    });
  });

  it("以前の全項目オンは、必須以外を出さない初期値にする", () => {
    const parsed = parseForecastColumns(
      JSON.stringify({
        weather: true,
        feel: true,
        wbgt: true,
        temperature: true,
        humidity: true,
        wind: true,
        solar: true,
      }),
    );
    expect(parsed).toEqual({
      temperature: false,
      humidity: false,
      wind: false,
      solar: false,
    });
  });

  it("任意の列だけ残せる", () => {
    const parsed = parseForecastColumns(JSON.stringify({ temperature: true, humidity: false }));
    expect(parsed.temperature).toBe(true);
    expect(parsed.humidity).toBe(false);
    expect(parsed.wind).toBe(false);
  });
});
