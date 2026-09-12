import { describe, expect, it } from "vitest";
import { classifyWbgtZone, runRowClass } from "../lib/weatherZone";

describe("classifyWbgtZone", () => {
  it("境界は下側を含み、値が無いときは none にする", () => {
    expect(classifyWbgtZone(null)).toBe("none");
    expect(classifyWbgtZone(9.9)).toBe("too_cold");
    expect(classifyWbgtZone(10)).toBe("cold");
    expect(classifyWbgtZone(15)).toBe("comfort");
    expect(classifyWbgtZone(21)).toBe("hot");
    expect(classifyWbgtZone(28)).toBe("too_hot");
  });
});

describe("runRowClass", () => {
  it("気象ゾーンを心拍より優先する", () => {
    expect(runRowClass({ weather_zone: "comfort", hr_zone: "high" })).toBe("wbgt-comfort");
    expect(runRowClass({ weather_zone: "none", hr_zone: null })).toBe("wbgt-none");
    expect(runRowClass({ weather_zone: null, hr_zone: "low" })).toBe("zone-low");
    expect(runRowClass({ weather_zone: null, hr_zone: null })).toBeUndefined();
  });
});
