import type { IntensityHrs } from "./types";

const RATIOS: { key: keyof IntensityHrs; ratio: number }[] = [
  { key: "low", ratio: 0.65 },
  { key: "medium", ratio: 0.75 },
  { key: "high", ratio: 0.85 },
  { key: "race_5k", ratio: 0.95 },
  { key: "race_10k", ratio: 0.92 },
  { key: "race_half", ratio: 0.88 },
  { key: "race_full", ratio: 0.8 },
];

export function ageFromBirthday(birthday: string, today = new Date()): number {
  const [year, month, day] = birthday.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  return Math.max(age, 0);
}

export function maxHrFromAge(age: number): number {
  return Math.min(220, Math.max(80, 220 - age));
}

export function suggestedHrs(maxHeartRate: number): IntensityHrs {
  const values = {} as IntensityHrs;
  for (const item of RATIOS) {
    values[item.key] = Math.round(maxHeartRate * item.ratio);
  }
  return values;
}

export function emptyHrs(): IntensityHrs {
  return {
    low: null,
    medium: null,
    high: null,
    race_5k: null,
    race_10k: null,
    race_half: null,
    race_full: null,
  };
}
