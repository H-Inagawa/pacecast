export const RECENCY_LAMBDA_PER_DAY = 0.0075;
export const MIN_RESIDUAL_DF = 2;

export function paceKmh(paceSecPerKm: number): number {
  return 3600 / paceSecPerKm;
}

export function paceSecPerKm(paceKmhValue: number): number {
  return 3600 / Math.max(paceKmhValue, 0.1);
}

export function recencyWeight(startedAt: Date, asOf: Date): number {
  const days = Math.max((asOf.getTime() - startedAt.getTime()) / 86400000, 0);
  return Math.exp(-RECENCY_LAMBDA_PER_DAY * days);
}

export type Term = {
  key: string;
  label: string;
  needsHr: boolean;
  eval: (h: number, d: number, w: number) => number;
};

export const TERMS: Term[] = [
  { key: "1", label: "定数", needsHr: false, eval: () => 1 },
  { key: "W", label: "WBGT", needsHr: false, eval: (_h, _d, w) => w },
  { key: "D", label: "距離", needsHr: false, eval: (_h, d) => d },
  { key: "H", label: "心拍", needsHr: true, eval: (h) => h },
  { key: "WD", label: "WBGT×距離", needsHr: false, eval: (_h, d, w) => w * d },
  { key: "WH", label: "WBGT×心拍", needsHr: true, eval: (h, _d, w) => w * h },
  { key: "DH", label: "距離×心拍", needsHr: true, eval: (h, d) => d * h },
  { key: "W2", label: "WBGT²", needsHr: false, eval: (_h, _d, w) => w * w },
  { key: "D2", label: "距離²", needsHr: false, eval: (_h, d) => d * d },
  { key: "H2", label: "心拍²", needsHr: true, eval: (h) => h * h },
];

function solve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const work = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(work[pivot][col]) < 1e-10) {
      return null;
    }
    [work[col], work[pivot]] = [work[pivot], work[col]];
    const scale = work[col][col];
    for (let j = col; j <= n; j++) {
      work[col][j] /= scale;
    }
    for (let row = 0; row < n; row++) {
      if (row === col) {
        continue;
      }
      const factor = work[row][col];
      for (let j = col; j <= n; j++) {
        work[row][j] -= factor * work[col][j];
      }
    }
  }
  return work.map((row) => row[n]);
}

function standardize(values: number[], weights: number[]): [number, number] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const mean = values.reduce((sum, value, i) => sum + weights[i] * value, 0) / total;
  const variance =
    values.reduce((sum, value, i) => sum + weights[i] * (value - mean) ** 2, 0) / total;
  const std = variance > 1e-12 ? Math.sqrt(variance) : 1;
  return [mean, std];
}

export class FittedPaceModel {
  terms: Term[];
  coefficients: number[];
  hMean: number;
  hStd: number;
  dMean: number;
  dStd: number;
  wMean: number;
  wStd: number;
  r2: number;
  rmseSecPerKm: number;
  usesHr: boolean;

  constructor(args: {
    terms: Term[];
    coefficients: number[];
    hMean: number;
    hStd: number;
    dMean: number;
    dStd: number;
    wMean: number;
    wStd: number;
    r2: number;
    rmseSecPerKm: number;
    usesHr: boolean;
  }) {
    this.terms = args.terms;
    this.coefficients = args.coefficients;
    this.hMean = args.hMean;
    this.hStd = args.hStd;
    this.dMean = args.dMean;
    this.dStd = args.dStd;
    this.wMean = args.wMean;
    this.wStd = args.wStd;
    this.r2 = args.r2;
    this.rmseSecPerKm = args.rmseSecPerKm;
    this.usesHr = args.usesHr;
  }

  scaled(heartRate: number, distanceKm: number, wbgtC: number): [number, number, number] {
    return [
      (heartRate - this.hMean) / this.hStd,
      (distanceKm - this.dMean) / this.dStd,
      (wbgtC - this.wMean) / this.wStd,
    ];
  }

  predictKmh(heartRate: number, distanceKm: number, wbgtC: number): number {
    const scaled = this.scaled(heartRate, distanceKm, wbgtC);
    let total = 0;
    for (let i = 0; i < this.terms.length; i++) {
      total += this.coefficients[i] * this.terms[i].eval(...scaled);
    }
    return Math.max(total, 0.5);
  }

  formulaText(): string {
    const names = this.terms
      .filter((term) => term.key !== "1")
      .map((term) => term.label)
      .join(" + ");
    if (!names) {
      return "直近ほど重い重み付き平均";
    }
    return `ペース(km/h) = 定数 + ${names}（各変数は標準化）`;
  }
}

export function chooseTerms(sampleCount: number, usesHr: boolean): Term[] {
  const chosen: Term[] = [];
  for (const term of TERMS) {
    if (term.needsHr && !usesHr) {
      continue;
    }
    if (sampleCount < chosen.length + 1 + MIN_RESIDUAL_DF) {
      break;
    }
    chosen.push(term);
  }
  return chosen.length > 0 ? chosen : [TERMS[0]];
}

function usableTerms(
  terms: Term[],
  heartRates: number[],
  distances: number[],
  wbgts: number[],
  hMean: number,
  hStd: number,
  dMean: number,
  dStd: number,
  wMean: number,
  wStd: number,
): Term[] {
  const usable: Term[] = [];
  for (const term of terms) {
    const column: number[] = [];
    for (let i = 0; i < heartRates.length; i++) {
      const scaled: [number, number, number] = [
        (heartRates[i] - hMean) / hStd,
        (distances[i] - dMean) / dStd,
        (wbgts[i] - wMean) / wStd,
      ];
      column.push(term.eval(...scaled));
    }
    if (term.key === "1" || Math.max(...column) - Math.min(...column) > 1e-8) {
      usable.push(term);
    }
  }
  return usable.length > 0 ? usable : [TERMS[0]];
}

export function fitPaceModel(
  heartRates: number[],
  distances: number[],
  wbgts: number[],
  pacesSec: number[],
  weights: number[],
  usesHr: boolean,
): FittedPaceModel | null {
  const n = pacesSec.length;
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (n < 2 || weightSum <= 0) {
    return null;
  }
  const [hMean, hStd] = standardize(heartRates, weights);
  const [dMean, dStd] = standardize(distances, weights);
  const [wMean, wStd] = standardize(wbgts, weights);
  const y = pacesSec.map(paceKmh);
  const ySec = [...pacesSec];

  let terms = usableTerms(
    chooseTerms(n, usesHr),
    heartRates,
    distances,
    wbgts,
    hMean,
    hStd,
    dMean,
    dStd,
    wMean,
    wStd,
  );
  while (terms.length > 0) {
    const rows: number[][] = [];
    for (let i = 0; i < heartRates.length; i++) {
      const scaled: [number, number, number] = [
        (heartRates[i] - hMean) / hStd,
        (distances[i] - dMean) / dStd,
        (wbgts[i] - wMean) / wStd,
      ];
      rows.push(terms.map((term) => term.eval(...scaled)));
    }
    const xtwx = terms.map(() => terms.map(() => 0));
    const xtwy = terms.map(() => 0);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const target = y[rowIndex];
      const weight = weights[rowIndex];
      for (let i = 0; i < row.length; i++) {
        xtwy[i] += weight * row[i] * target;
        for (let j = 0; j < row.length; j++) {
          xtwx[i][j] += weight * row[i] * row[j];
        }
      }
    }
    const coef = solve(xtwx, xtwy);
    if (coef != null) {
      const fitted = new FittedPaceModel({
        terms,
        coefficients: coef,
        hMean,
        hStd,
        dMean,
        dStd,
        wMean,
        wStd,
        r2: 0,
        rmseSecPerKm: 0,
        usesHr,
      });
      const predsKmh = heartRates.map((heart, i) => fitted.predictKmh(heart, distances[i], wbgts[i]));
      const predsSec = predsKmh.map(paceSecPerKm);
      const totalW = weightSum;
      const ybar = y.reduce((sum, target, i) => sum + weights[i] * target, 0) / totalW;
      const ssRes = y.reduce((sum, target, i) => sum + weights[i] * (target - predsKmh[i]) ** 2, 0);
      const ssTot = y.reduce((sum, target, i) => sum + weights[i] * (target - ybar) ** 2, 0);
      fitted.r2 = ssTot <= 1e-12 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
      fitted.rmseSecPerKm = Math.sqrt(
        ySec.reduce((sum, actual, i) => sum + weights[i] * (actual - predsSec[i]) ** 2, 0) / totalW,
      );
      return fitted;
    }
    if (terms.length === 1) {
      return null;
    }
    terms = terms.slice(0, -1);
  }
  return null;
}
