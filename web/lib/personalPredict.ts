/** 心拍補正と一般・個人 WBGT を混ぜた予測。方針は docs/02_architecture/issue-44-prediction.md */

export const PERSONAL_PRIOR_K = 10;
export const MIN_PERSONAL_HR_RUNS = 6;

const HALF_LIFE_DAYS = 180;
const WBGT_SIGMA = 5;
const DISTANCE_SIGMA = 5;
const HR_SIGMA = 10;
const PACE_SIGMA_SEC = 30;
const SLOW_EFFECT_SCALE = 1.5;
const CURVE_POINTS = 21;

type Band = {
  distanceKm: number;
  optimalWbgt: number;
  hotSlope: number;
  coldSlope: number;
  elitePaceSecPerKm: number;
  slowPaceSecPerKm: number;
};

/**
 * Figure S1（PMC8677617）の概形を目視で読んだ近似。
 * 最適 WBGT で補正 0。暑い側・寒い側は 1℃ あたりのタイム割合。
 * 遅い参照ペースより遅い走は傾きを SLOW_EFFECT_SCALE まで上げる（S11 / S12 の遅い列の考え方）。
 */
const BANDS: Band[] = [
  { distanceKm: 5, optimalWbgt: 15, hotSlope: 0.0018, coldSlope: 0.0012, elitePaceSecPerKm: 180, slowPaceSecPerKm: 300 },
  { distanceKm: 10, optimalWbgt: 12, hotSlope: 0.002, coldSlope: 0.0013, elitePaceSecPerKm: 180, slowPaceSecPerKm: 300 },
  { distanceKm: 21.0975, optimalWbgt: 10, hotSlope: 0.0026, coldSlope: 0.0015, elitePaceSecPerKm: 200, slowPaceSecPerKm: 340 },
  { distanceKm: 42.195, optimalWbgt: 10, hotSlope: 0.003, coldSlope: 0.0016, elitePaceSecPerKm: 185, slowPaceSecPerKm: 340 },
];

export type PersonalRun = {
  id: number;
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  avgHeartRate: number;
  wbgtC: number;
};

export type PersonalPoint = { x: number; paceSecPerKm: number };

export type PersonalFit = {
  predictedPaceSecPerKm: number;
  generalEffect: number;
  personalEffect: number;
  finalEffect: number;
  alpha: number;
  classSampleCount: number;
  sampleCount: number;
  rSquared: number;
  rmseSecPerKm: number;
  formula: string;
  heartRateAdjusted: boolean;
  ranked: { id: number; weight: number }[];
  wbgtObserved: PersonalPoint[];
  wbgtCurve: PersonalPoint[];
  hrObserved: PersonalPoint[];
  hrCurve: PersonalPoint[];
};

export const RUN_WEIGHT_HELP = [
  "100 が最大です。条件が完全に一致すると 100.00 です。大きいほど今回の条件に近い走です。",
  "表は、次の重みの積が大きい順に 5 件です。",
  "速いペースほど重い（目標心拍へ補正したペースが 30 秒/km 遅れるごとに、重みは約 0.37 倍）。",
  "直近ほど重い（半減期は 180 日）。",
  "予測する WBGT に近いほど重い（5℃ 離れると約 0.37 倍）。",
  "予測する距離に近いほど重い（5 km 離れると約 0.37 倍）。",
].join("\n");

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function daysBetween(asOf: Date, started: Date): number {
  return Math.max(0, (asOf.getTime() - started.getTime()) / 86_400_000);
}

function kernel(delta: number, sigma: number): number {
  return Math.exp(-Math.abs(delta) / sigma);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function bandAt(distanceKm: number): Band {
  if (distanceKm <= BANDS[0].distanceKm) {
    return BANDS[0];
  }
  const last = BANDS[BANDS.length - 1];
  if (distanceKm >= last.distanceKm) {
    return last;
  }
  for (let index = 0; index < BANDS.length - 1; index += 1) {
    const left = BANDS[index];
    const right = BANDS[index + 1];
    if (distanceKm <= right.distanceKm) {
      const t = (distanceKm - left.distanceKm) / (right.distanceKm - left.distanceKm);
      return {
        distanceKm,
        optimalWbgt: lerp(left.optimalWbgt, right.optimalWbgt, t),
        hotSlope: lerp(left.hotSlope, right.hotSlope, t),
        coldSlope: lerp(left.coldSlope, right.coldSlope, t),
        elitePaceSecPerKm: lerp(left.elitePaceSecPerKm, right.elitePaceSecPerKm, t),
        slowPaceSecPerKm: lerp(left.slowPaceSecPerKm, right.slowPaceSecPerKm, t),
      };
    }
  }
  return last;
}

function abilityScale(paceSecPerKm: number, band: Band): number {
  if (paceSecPerKm <= band.elitePaceSecPerKm) {
    return 1;
  }
  if (paceSecPerKm >= band.slowPaceSecPerKm) {
    return SLOW_EFFECT_SCALE;
  }
  const t = (paceSecPerKm - band.elitePaceSecPerKm) / (band.slowPaceSecPerKm - band.elitePaceSecPerKm);
  return lerp(1, SLOW_EFFECT_SCALE, t);
}

function piecewise(wbgt: number, optimal: number, hotSlope: number, coldSlope: number): number {
  if (wbgt >= optimal) {
    return (wbgt - optimal) * hotSlope;
  }
  return (optimal - wbgt) * coldSlope;
}

function generalEffect(distanceKm: number, wbgt: number, paceSecPerKm: number): number {
  const band = bandAt(distanceKm);
  const scale = abilityScale(paceSecPerKm, band);
  return clamp(piecewise(wbgt, band.optimalWbgt, band.hotSlope * scale, band.coldSlope * scale), -0.15, 0.5);
}

function weightedLine(xs: number[], ys: number[], weights: number[]): { a: number; b: number } | null {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const weight = weights[index];
    if (!(weight > 0)) {
      continue;
    }
    const x = xs[index];
    const y = ys[index];
    sw += weight;
    sx += weight * x;
    sy += weight * y;
    sxx += weight * x * x;
    sxy += weight * x * y;
  }
  const denom = sw * sxx - sx * sx;
  if (!(sw > 0) || Math.abs(denom) < 1e-9) {
    return null;
  }
  const b = (sw * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / sw;
  return { a, b };
}

function weightedSlope(xs: number[], ys: number[], weights: number[]): number {
  const fit = weightedLine(xs, ys, weights);
  if (fit == null || xs.length < 3) {
    return 0;
  }
  return fit.b;
}

function heartRateFormula(line: { a: number; b: number } | null, used: boolean): string {
  if (line == null) {
    return "心拍とペースの傾きが使えないため、記録のペースをそのまま重み付け";
  }
  const magnitude = Math.abs(line.b).toFixed(3);
  const term = line.b < 0 ? `− ${magnitude}` : `+ ${magnitude}`;
  const equation = `速度(km/h) = ${line.a.toFixed(2)} ${term} × 心拍`;
  if (used) {
    return equation;
  }
  return `${equation}\n心拍とペースの傾きが使えないため、記録のペースをそのまま重み付け`;
}

function linspace(low: number, high: number, count = CURVE_POINTS): number[] {
  if (count < 2 || Math.abs(high - low) < 1e-9) {
    return [low];
  }
  const step = (high - low) / (count - 1);
  return Array.from({ length: count }, (_, index) => low + step * index);
}

function binOf(value: number): number {
  return Math.floor(value / 5) * 5;
}

function classFactor(distanceKm: number, wbgt: number, targetDistance: number, targetWbgt: number): number {
  const steps = Math.max(
    Math.abs(binOf(distanceKm) - binOf(targetDistance)) / 5,
    Math.abs(binOf(wbgt) - binOf(targetWbgt)) / 5,
  );
  if (steps === 0) {
    return 1;
  }
  if (steps === 1) {
    return 0.5;
  }
  return 0;
}

/**
 * 目標心拍と WBGT・距離からペース（秒/km）を推定する。
 *
 * Args:
 *   runs: 心拍と推定 WBGT がある過去走。
 *   targetWbgt: 予測する推定 WBGT（℃）。
 *   distanceKm: 予測する距離（km）。
 *   targetHr: 目標心拍（bpm）。
 *   asOf: 直近重みの基準日時。
 *
 * Returns:
 *   予測。心拍の傾きが使えないときは null。
 */
export function tryPersonalPrediction(
  runs: PersonalRun[],
  targetWbgt: number,
  distanceKm: number,
  targetHr: number,
  asOf: Date,
): PersonalFit | null {
  if (runs.length < MIN_PERSONAL_HR_RUNS) {
    return null;
  }
  const proximity = runs.map((run) => {
    const recency = 2 ** (-daysBetween(asOf, run.startedAt) / HALF_LIFE_DAYS);
    return (
      recency *
      kernel(run.wbgtC - targetWbgt, WBGT_SIGMA) *
      kernel(run.distanceKm - distanceKm, DISTANCE_SIGMA) *
      kernel(run.avgHeartRate - targetHr, HR_SIGMA)
    );
  });
  const speeds = runs.map((run) => run.distanceKm / (run.durationSec / 3600));
  const line = weightedLine(
    runs.map((run) => run.avgHeartRate),
    speeds,
    proximity,
  );
  const speedAt = (heartRate: number) => (line == null ? 0 : line.a + line.b * heartRate);
  const heartRateAdjusted = line != null && line.b > 0 && speedAt(targetHr) > 0.5 && runs.every((run) => speedAt(run.avgHeartRate) > 0.5);
  const adjustedPaces = runs.map((run) => {
    const pace = run.durationSec / run.distanceKm;
    if (!heartRateAdjusted || line == null) {
      return pace;
    }
    return pace * (speedAt(run.avgHeartRate) / speedAt(targetHr));
  });

  const neutral = adjustedPaces.map((pace, index) => pace / (1 + generalEffect(runs[index].distanceKm, runs[index].wbgtC, pace)));
  const fastest = Math.min(...neutral);
  const baseWeights = neutral.map((pace, index) => {
    const run = runs[index];
    const recency = 2 ** (-daysBetween(asOf, run.startedAt) / HALF_LIFE_DAYS);
    return (
      Math.exp(-(pace - fastest) / PACE_SIGMA_SEC) *
      recency *
      kernel(run.wbgtC - targetWbgt, WBGT_SIGMA) *
      kernel(run.distanceKm - distanceKm, DISTANCE_SIGMA)
    );
  });
  const weightSum = baseWeights.reduce((sum, weight) => sum + weight, 0);
  if (!(weightSum > 0)) {
    return null;
  }
  const basePace = neutral.reduce((sum, pace, index) => sum + pace * baseWeights[index], 0) / weightSum;
  if (!(basePace > 0)) {
    return null;
  }

  const optimal = bandAt(distanceKm).optimalWbgt;
  const coldX: number[] = [];
  const coldY: number[] = [];
  const coldW: number[] = [];
  const hotX: number[] = [];
  const hotY: number[] = [];
  const hotW: number[] = [];
  adjustedPaces.forEach((pace, index) => {
    const run = runs[index];
    const y = Math.log(pace);
    const weight = proximity[index];
    if (run.wbgtC < optimal) {
      coldX.push(optimal - run.wbgtC);
      coldY.push(y);
      coldW.push(weight);
    } else {
      hotX.push(run.wbgtC - optimal);
      hotY.push(y);
      hotW.push(weight);
    }
  });
  const coldSlope = Math.max(0, weightedSlope(coldX, coldY, coldW));
  const hotSlope = Math.max(0, weightedSlope(hotX, hotY, hotW));
  const personalAt = (wbgt: number) => clamp(piecewise(wbgt, optimal, hotSlope, coldSlope), -0.15, 0.5);

  let nEff = 0;
  let classCount = 0;
  runs.forEach((run, index) => {
    const factor = classFactor(run.distanceKm, run.wbgtC, distanceKm, targetWbgt);
    if (factor === 1) {
      classCount += 1;
    }
    const recency = 2 ** (-daysBetween(asOf, run.startedAt) / HALF_LIFE_DAYS);
    const kernelWeight =
      recency * kernel(run.wbgtC - targetWbgt, WBGT_SIGMA) * kernel(run.distanceKm - distanceKm, DISTANCE_SIGMA);
    nEff += kernelWeight * factor;
  });
  const alpha = nEff / (nEff + PERSONAL_PRIOR_K);
  const general = generalEffect(distanceKm, targetWbgt, basePace);
  const personal = personalAt(targetWbgt);
  const finalEffect = clamp((1 - alpha) * general + alpha * personal, -0.15, 0.5);
  const predicted = basePace * (1 + finalEffect);

  const blendAt = (wbgt: number) =>
    clamp((1 - alpha) * generalEffect(distanceKm, wbgt, basePace) + alpha * personalAt(wbgt), -0.15, 0.5);
  const predictedAt = adjustedPaces.map((_, index) => basePace * (1 + blendAt(runs[index].wbgtC)));
  const fitWeight = baseWeights;
  const mean = adjustedPaces.reduce((sum, pace, index) => sum + pace * fitWeight[index], 0) / weightSum;
  let ssTot = 0;
  let ssRes = 0;
  adjustedPaces.forEach((pace, index) => {
    ssTot += fitWeight[index] * (pace - mean) ** 2;
    ssRes += fitWeight[index] * (pace - predictedAt[index]) ** 2;
  });
  const rSquared = ssTot > 1e-9 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(ssRes / weightSum);

  const optimalWbgt = bandAt(distanceKm).optimalWbgt;
  const wbgtValues = runs.map((run) => run.wbgtC);
  const wbgtLow = Math.min(...wbgtValues, targetWbgt, optimalWbgt - 2);
  const wbgtHigh = Math.max(...wbgtValues, targetWbgt, optimalWbgt + 2);
  const hrValues = runs.map((run) => run.avgHeartRate);
  const hrLow = Math.min(...hrValues, targetHr) - 5;
  const hrHigh = Math.max(...hrValues, targetHr) + 5;
  const hrXs = line == null ? [] : linspace(hrLow, hrHigh);
  const hrCurve =
    hrXs.length > 0 && hrXs.every((heartRate) => speedAt(heartRate) > 0.5)
      ? hrXs.map((heartRate) => ({
          x: heartRate,
          paceSecPerKm: 3600 / speedAt(heartRate),
        }))
      : [];

  const formula = heartRateFormula(line, heartRateAdjusted);

  return {
    predictedPaceSecPerKm: predicted,
    generalEffect: general,
    personalEffect: personal,
    finalEffect,
    alpha,
    classSampleCount: classCount,
    sampleCount: runs.length,
    rSquared,
    rmseSecPerKm: rmse,
    formula,
    heartRateAdjusted,
    ranked: runs
      .map((run, index) => ({ id: run.id, weight: baseWeights[index] }))
      .sort((left, right) => right.weight - left.weight),
    wbgtObserved: runs.map((run, index) => ({ x: run.wbgtC, paceSecPerKm: adjustedPaces[index] })),
    wbgtCurve: linspace(wbgtLow, wbgtHigh).map((wbgt) => ({
      x: wbgt,
      paceSecPerKm: basePace * (1 + blendAt(wbgt)),
    })),
    hrObserved: runs.map((run) => ({ x: run.avgHeartRate, paceSecPerKm: run.durationSec / run.distanceKm })),
    hrCurve,
  };
}
