import type { Run } from "./types";

export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const rem = total % 3600;
  const minutes = Math.floor(rem / 60);
  const secs = rem % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatDistanceKm(km: number): string {
  return `${km.toFixed(2)}km`;
}

export function formatRunSummary(count: number, distanceKm: number): string {
  return `走行件数：${count}件 走行距離：${formatDistanceKm(distanceKm)}`;
}

export function formatDate(value: string): string {
  const [date] = value.split("T");
  return date.replaceAll("-", "/");
}

export function formatDateTime(value: string): string {
  return value.replace("T", " ").replaceAll("-", "/").slice(0, 16);
}

export function defaultDateTimeLocal(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function confidenceLabel(value: string): string {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

export function groupRunsByMonth(runs: Run[]): { key: string; label: string; total: number; runs: Run[] }[] {
  const groups = new Map<string, { key: string; label: string; total: number; runs: Run[] }>();
  for (const run of runs) {
    const key = run.started_at.slice(0, 7);
    const [year, month] = key.split("-");
    const current = groups.get(key) ?? {
      key,
      label: `${Number(year)}年${Number(month)}月`,
      total: 0,
      runs: [],
    };
    current.total += run.distance_km;
    current.runs.push(run);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
