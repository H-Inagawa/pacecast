import { describe, expect, it } from "vitest";
import { tryPersonalPrediction } from "../lib/personalPredict";

const asOf = new Date("2026-09-13T12:00:00+09:00");

function run(index: number, heartRate: number, wbgt: number, paceSec: number) {
  return {
    id: index + 1,
    startedAt: new Date(Date.UTC(2026, 7, 1 + index, 0, 0)),
    distanceKm: 5,
    durationSec: paceSec * 5,
    avgHeartRate: heartRate,
    wbgtC: wbgt,
  };
}

describe("個人WBGT予測", () => {
  it("心拍が高い目標のほうが速く、暑いほうが遅い", () => {
    const runs = Array.from({ length: 8 }, (_, index) =>
      run(index, 120 + index * 8, 16 + index, 360 - index * 6 + index),
    );
    const easy = tryPersonalPrediction(runs, 20, 5, 125, asOf);
    const hard = tryPersonalPrediction(runs, 20, 5, 175, asOf);
    const hot = tryPersonalPrediction(runs, 28, 5, 150, asOf);
    const cool = tryPersonalPrediction(runs, 16, 5, 150, asOf);
    expect(easy).not.toBeNull();
    expect(hard).not.toBeNull();
    expect(cool).not.toBeNull();
    expect(hot).not.toBeNull();
    expect(hard!.predictedPaceSecPerKm).toBeLessThan(easy!.predictedPaceSecPerKm);
    expect(cool!.predictedPaceSecPerKm).toBeLessThan(hot!.predictedPaceSecPerKm);
    expect(hard!.formula).toContain("速度(km/h)");
    expect(hard!.ranked.length).toBe(8);
  });

  it("傾きが負でも、当てはめた a と b を式に出す", () => {
    const runs = Array.from({ length: 8 }, (_, index) => run(index, 140 + index * 5, 18, 280 + index * 15));
    const fit = tryPersonalPrediction(runs, 18, 5, 150, asOf);
    expect(fit?.heartRateAdjusted).toBe(false);
    expect(fit?.formula.split("\n")[0]).toMatch(/^速度\(km\/h\) = -?\d+\.\d+ − \d+\.\d+ × 心拍$/);
  });

  it("WBGT の線は最適値の前後と予測対象まで含む", () => {
    const runs = Array.from({ length: 8 }, (_, index) => run(index, 140 + index * 4, 24 + index * 0.4, 300));
    const fit = tryPersonalPrediction(runs, 26, 10, 160, asOf);
    const xs = fit!.wbgtCurve.map((point) => point.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(10);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(26);
    expect(fit!.formula.startsWith("速度(km/h)")).toBe(true);
    expect(fit!.formula).not.toContain("基準ペース");
  });

  it("心拍が揃っていても、ペースの重み付けと WBGT 補正は行う", () => {
    const runs = Array.from({ length: 8 }, (_, index) => run(index, 150, 16 + index, 300 + index * 6));
    const cool = tryPersonalPrediction(runs, 16, 5, 150, asOf);
    const hot = tryPersonalPrediction(runs, 28, 5, 150, asOf);
    expect(cool?.heartRateAdjusted).toBe(false);
    expect(hot).not.toBeNull();
    expect(cool!.predictedPaceSecPerKm).toBeLessThan(hot!.predictedPaceSecPerKm);
  });
});
