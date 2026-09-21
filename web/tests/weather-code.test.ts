import { describe, expect, it } from "vitest";
import { weatherCodeLabel } from "../lib/weatherCode";

describe("weatherCodeLabel", () => {
  it("Open-Meteo の天気コードを日本語にする", () => {
    expect(weatherCodeLabel(null)).toBe("—");
    expect(weatherCodeLabel(0)).toBe("快晴");
    expect(weatherCodeLabel(2)).toBe("晴れ");
    expect(weatherCodeLabel(61)).toBe("雨");
    expect(weatherCodeLabel(95)).toBe("雷雨");
  });
});
