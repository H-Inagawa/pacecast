import { describe, expect, it } from "vitest";
import { formatWindWithDirection, windDirectionLabel } from "../lib/wind";

describe("wind", () => {
  it("度を8方位の日本語にする", () => {
    expect(windDirectionLabel(0)).toBe("北");
    expect(windDirectionLabel(45)).toBe("北東");
    expect(windDirectionLabel(90)).toBe("東");
    expect(windDirectionLabel(180)).toBe("南");
    expect(windDirectionLabel(337.5)).toBe("北");
    expect(windDirectionLabel(null)).toBeNull();
  });

  it("風向と風速を並べて出す", () => {
    expect(formatWindWithDirection(4.8, 45)).toBe("北東 4.8m/s");
    expect(formatWindWithDirection(2.0, null)).toBe("2.0m/s");
  });
});
