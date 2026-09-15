import { DEFAULT_TIMEZONE, NEAR_WEATHER_DISTANCE } from "../constants";
import { FittedPaceModel, fitPaceModel, paceSecPerKm, recencyWeight } from "../regression";

export const MIN_HR_RUNS = 6;
export const CURVE_POINTS = 21;

export type PredictRun = {
  id: number;
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  avgHeartRate: number | null;
  temperatureC: number;
  humidityPct: number;
  wbgtC: number;
};

export type SimilarRun = {
  recordId: number;
  startedAt: string;
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
  avgHeartRate: number | null;
  temperatureC: number;
  humidityPct: number;
  wbgtC: number;
  weatherDistance: number;
  wbgtDelta: number;
  weight: number;
};

export type ChartPoint = {
  x: number;
  paceSecPerKm: number;
};

export type RelationChart = {
  key: string;
  title: string;
  xLabel: string;
  note: string;
  observed: ChartPoint[];
  curve: ChartPoint[];
};

export type PredictionResult = {
  predictedPaceSecPerKm: number;
  predictedDurationSec: number;
  predictedHeartRate: number | null;
  confidence: string;
  sampleCount: number;
  nearCount: number;
  usedRuns: SimilarRun[];
  intensityKey: string;
  intensityLabel: string;
  rSquared: number;
  rmseSecPerKm: number;
  modelFormula: string;
  usesHr: boolean;
  relationCharts: RelationChart[];
};

export type PredictPerformanceOptions = {
  intensityKey?: string;
  intensityLabel?: string;
  targetHr?: number | null;
  asOf?: Date | null;
};

export function weatherDistance(wbgtA: number, wbgtB: number): number {
  return Math.abs(wbgtA - wbgtB);
}

function confidenceFromR2(rSquared: number): string {
  if (rSquared >= 0.7) {
    return "high";
  }
  if (rSquared >= 0.4) {
    return "medium";
  }
  return "low";
}

function linspace(low: number, high: number, count = CURVE_POINTS): number[] {
  if (count < 2 || Math.abs(high - low) < 1e-9) {
    return [low];
  }
  const step = (high - low) / (count - 1);
  return Array.from({ length: count }, (_, index) => low + step * index);
}

function runPaceSecPerKm(run: PredictRun): number {
  return run.durationSec / run.distanceKm;
}

function formatStartedAt(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function curve(
  model: FittedPaceModel,
  key: string,
  xs: number[],
  heartRate: number,
  distanceKm: number,
  wbgtC: number,
): ChartPoint[] {
  return xs.map((value) => {
    let kmh: number;
    if (key === "wbgt") {
      kmh = model.predictKmh(heartRate, distanceKm, value);
    } else if (key === "distance") {
      kmh = model.predictKmh(heartRate, value, wbgtC);
    } else {
      kmh = model.predictKmh(value, distanceKm, wbgtC);
    }
    return { x: value, paceSecPerKm: paceSecPerKm(kmh) };
  });
}

function relationCharts(
  model: FittedPaceModel,
  records: PredictRun[],
  heartRate: number,
  distanceKm: number,
  wbgtC: number,
): RelationChart[] {
  const wbgtObs = records.map((record) => ({
    x: record.wbgtC,
    paceSecPerKm: runPaceSecPerKm(record),
  }));
  const hrObs = records
    .filter((record) => record.avgHeartRate != null)
    .map((record) => ({
      x: Number(record.avgHeartRate),
      paceSecPerKm: runPaceSecPerKm(record),
    }));
  const distObs = records.map((record) => ({
    x: record.distanceKm,
    paceSecPerKm: runPaceSecPerKm(record),
  }));

  const domain = (points: ChartPoint[], fallback: number): number[] => {
    if (points.length === 0) {
      return [fallback];
    }
    const xs = points.map((point) => point.x);
    return linspace(Math.min(...xs), Math.max(...xs));
  };

  const wbgtCurve = curve(model, "wbgt", domain(wbgtObs, wbgtC), heartRate, distanceKm, wbgtC);
  const distCurve = curve(model, "distance", domain(distObs, distanceKm), heartRate, distanceKm, wbgtC);
  const hrCurve =
    model.usesHr && hrObs.length > 0
      ? curve(model, "heart_rate", domain(hrObs, heartRate), heartRate, distanceKm, wbgtC)
      : [];

  return [
    {
      key: "wbgt",
      title: "WBGT とペース",
      xLabel: "推定 WBGT（℃）",
      note: "距離と心拍は予測条件で固定",
      observed: wbgtObs,
      curve: wbgtCurve,
    },
    {
      key: "heart_rate",
      title: "心拍 とペース",
      xLabel: "平均心拍（bpm）",
      note: model.usesHr
        ? "WBGT と距離は予測条件で固定"
        : "心拍付きが少ないため、今回の式に心拍は入れていません",
      observed: hrObs,
      curve: hrCurve,
    },
    {
      key: "distance",
      title: "距離 とペース",
      xLabel: "距離（km）",
      note: "WBGT と心拍は予測条件で固定",
      observed: distObs,
      curve: distCurve,
    },
  ];
}

function toSimilar(record: PredictRun, targetWbgt: number, weight: number): SimilarRun {
  return {
    recordId: record.id,
    startedAt: formatStartedAt(record.startedAt),
    distanceKm: record.distanceKm,
    durationSec: record.durationSec,
    paceSecPerKm: runPaceSecPerKm(record),
    avgHeartRate: record.avgHeartRate,
    temperatureC: record.temperatureC,
    humidityPct: record.humidityPct,
    wbgtC: record.wbgtC,
    weatherDistance: weatherDistance(targetWbgt, record.wbgtC),
    wbgtDelta: record.wbgtC - targetWbgt,
    weight,
  };
}

export function predictPerformance(
  runs: PredictRun[],
  wbgtC: number,
  distanceKm: number,
  options: PredictPerformanceOptions = {},
): PredictionResult | null {
  const intensityKey = options.intensityKey ?? "medium";
  const intensityLabel = options.intensityLabel ?? "中強度";
  const targetHr = options.targetHr ?? null;
  const eligible = runs;
  if (eligible.length === 0) {
    return null;
  }

  const asOfDt = options.asOf ?? new Date();
  const hrRows = eligible.filter((record) => record.avgHeartRate != null);
  const usesHr = hrRows.length >= MIN_HR_RUNS;
  const fitRows = usesHr ? hrRows : eligible;
  if (fitRows.length < 2) {
    return null;
  }

  const model = fitPaceModel(
    fitRows.map((record) => Number(record.avgHeartRate ?? 0)),
    fitRows.map((record) => record.distanceKm),
    fitRows.map((record) => record.wbgtC),
    fitRows.map(runPaceSecPerKm),
    fitRows.map((record) => recencyWeight(record.startedAt, asOfDt)),
    usesHr,
  );
  if (model == null) {
    return null;
  }

  const predictHr = targetHr != null ? Number(targetHr) : usesHr ? model.hMean : 0;
  const pace = paceSecPerKm(model.predictKmh(predictHr, distanceKm, wbgtC));
  const nearCount = eligible.filter(
    (record) => weatherDistance(wbgtC, record.wbgtC) <= NEAR_WEATHER_DISTANCE,
  ).length;
  const usedRuns = [...fitRows]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 8)
    .map((record) => toSimilar(record, wbgtC, recencyWeight(record.startedAt, asOfDt)));

  return {
    predictedPaceSecPerKm: pace,
    predictedDurationSec: Math.round(pace * distanceKm),
    predictedHeartRate: targetHr != null ? Number(targetHr) : null,
    confidence: confidenceFromR2(model.r2),
    sampleCount: fitRows.length,
    nearCount,
    usedRuns,
    intensityKey,
    intensityLabel,
    rSquared: model.r2,
    rmseSecPerKm: model.rmseSecPerKm,
    modelFormula: model.formulaText(),
    usesHr,
    relationCharts: relationCharts(model, fitRows, predictHr, distanceKm, wbgtC),
  };
}
