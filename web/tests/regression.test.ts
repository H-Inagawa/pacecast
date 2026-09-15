import { describe, expect, it } from "vitest";
import {
  chooseTerms,
  fitPaceModel,
  paceKmh,
  paceSecPerKm,
  recencyWeight,
} from "../lib/regression";

describe("regression", () => {
  it("秒/km と km/h を行き来できる", () => {
    expect(paceKmh(360)).toBe(10);
    expect(paceSecPerKm(12)).toBe(300);
  });

  it("新しい走のほうが重い", () => {
    const asOf = new Date(2026, 8, 13, 12, 0);
    const recent = recencyWeight(new Date(asOf.getTime() - 7 * 86400000), asOf);
    const older = recencyWeight(new Date(asOf.getTime() - 30 * 86400000), asOf);
    expect(recent).toBeGreaterThan(older);
    expect(recent).toBeGreaterThan(0.94);
    expect(recent).toBeLessThan(0.96);
    expect(older).toBeGreaterThan(0.79);
    expect(older).toBeLessThan(0.81);
  });

  it("件数が多いほど交差・2次まで入る", () => {
    const few = chooseTerms(4, true).map((term) => term.key);
    const many = chooseTerms(20, true).map((term) => term.key);
    const noHr = chooseTerms(20, false).map((term) => term.key);
    expect(few).toEqual(["1", "W"]);
    expect(many).toContain("H");
    expect(many).toContain("WH");
    expect(many).toContain("H2");
    expect(noHr).not.toContain("H");
    expect(noHr).not.toContain("WH");
  });

  it("WBGT が高いほど遅いデータでは、涼しい条件の予測が速い", () => {
    const wbgts = Array.from({ length: 8 }, (_, index) => 16 + index);
    const paces = Array.from({ length: 8 }, (_, index) => 300 + 6 * index);
    const model = fitPaceModel(
      Array(8).fill(150),
      Array(8).fill(5),
      wbgts,
      paces,
      Array(8).fill(1),
      true,
    );
    expect(model).not.toBeNull();
    const cool = paceSecPerKm(model!.predictKmh(150, 5, 16));
    const hot = paceSecPerKm(model!.predictKmh(150, 5, 23));
    expect(cool).toBeLessThan(hot);
    expect(model!.r2).toBeGreaterThan(0.9);
  });

  it("WBGT と距離が同じでも、心拍の項は残る", () => {
    const hearts = Array.from({ length: 8 }, (_, index) => 120 + 8 * index);
    const paces = Array.from({ length: 8 }, (_, index) => 400 - 8 * index);
    const model = fitPaceModel(
      hearts,
      Array(8).fill(5),
      Array(8).fill(20),
      paces,
      Array(8).fill(1),
      true,
    );
    expect(model).not.toBeNull();
    expect(model!.terms.some((term) => term.key === "H")).toBe(true);
    const easy = paceSecPerKm(model!.predictKmh(125, 5, 20));
    const hard = paceSecPerKm(model!.predictKmh(175, 5, 20));
    expect(hard).toBeLessThan(easy);
  });
});
