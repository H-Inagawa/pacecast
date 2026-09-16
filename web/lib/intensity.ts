export const INTENSITY_RATIOS: Record<string, number> = {
  low: 0.65,
  medium: 0.75,
  high: 0.85,
  race_5k: 0.95,
  race_10k: 0.92,
  race_half: 0.88,
  race_full: 0.8,
};

export const RACE_DISTANCES_KM: Record<string, number> = {
  race_5k: 5.0,
  race_10k: 10.0,
  race_half: 21.0975,
  race_full: 42.195,
};

export const INTENSITY_LABELS: Record<string, string> = {
  low: "低強度（60〜70%）",
  medium: "中強度（70〜80%）",
  high: "高強度（80〜90%）",
  race_5k: "5km（90〜100%）",
  race_10k: "10km（90〜95%）",
  race_half: "ハーフマラソン（85〜92%）",
  race_full: "フルマラソン（75〜88%）",
};

export const PROFILE_HR_FIELDS: Record<string, string> = {
  low: "hr_low",
  medium: "hr_medium",
  high: "hr_high",
  race_5k: "hr_race_5k",
  race_10k: "hr_race_10k",
  race_half: "hr_race_half",
  race_full: "hr_race_full",
};

export type IntensityPreset = {
  key: string;
  label: string;
  targetHr: number | null;
  distanceKm?: number | null;
};

export function hrFromMax(maxHeartRate: number, ratio: number): number {
  return Math.round(maxHeartRate * ratio);
}

export function suggestedIntensityHrs(maxHeartRate: number): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [key, ratio] of Object.entries(INTENSITY_RATIOS)) {
    values[key] = hrFromMax(maxHeartRate, ratio);
  }
  return values;
}

export function classifyRunZone(
  avgHeartRate: number | null,
  maxHeartRate: number | null,
  colorEnabled: boolean,
): "low" | "medium" | "high" | null {
  if (!colorEnabled || maxHeartRate == null || maxHeartRate <= 0 || avgHeartRate == null) {
    return null;
  }
  const ratio = avgHeartRate / maxHeartRate;
  if (ratio < 0.7) {
    return "low";
  }
  if (ratio < 0.8) {
    return "medium";
  }
  return "high";
}

export function listCustomIntensities(
  targetHrs: Record<string, number | null | undefined>,
): IntensityPreset[] {
  return (["low", "medium", "high"] as const).map((key) => ({
    key,
    label: INTENSITY_LABELS[key],
    targetHr: targetHrs[key] ?? null,
  }));
}

export function raceOptions(targetHrs: Record<string, number | null | undefined>): IntensityPreset[] {
  return (["race_5k", "race_10k", "race_half", "race_full"] as const).map((key) => ({
    key,
    label: INTENSITY_LABELS[key],
    targetHr: targetHrs[key] ?? null,
    distanceKm: RACE_DISTANCES_KM[key],
  }));
}
