import { describe, expect, it } from "vitest";
import { ageFromBirthday, maxHrFromAge, suggestedHrs } from "../lib/heartRate";

describe("heartRate", () => {
  it("満年齢は誕生日前なら1歳引く", () => {
    expect(ageFromBirthday("1995-09-20", new Date("2026-09-12"))).toBe(30);
    expect(ageFromBirthday("1995-09-12", new Date("2026-09-12"))).toBe(31);
  });

  it("最大心拍は 220 - 満年齢", () => {
    expect(maxHrFromAge(31)).toBe(189);
  });

  it("強度別心拍の初期値は最大心拍比から出す", () => {
    expect(suggestedHrs(189).medium).toBe(142);
  });
});
