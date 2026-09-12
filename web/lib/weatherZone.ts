export const ROW_COLOR_MODES = ["hr", "wbgt", "off"] as const;

export type RowColorMode = (typeof ROW_COLOR_MODES)[number];

export type WbgtZone = "too_cold" | "cold" | "comfort" | "hot" | "too_hot" | "none";

export const WBGT_ZONE_LABELS: Record<WbgtZone, string> = {
  too_cold: "寒すぎる（10未満）",
  cold: "寒い（10〜15）",
  comfort: "快適（15〜21）",
  hot: "暑い（21〜28）",
  too_hot: "暑すぎる（28以上）",
  none: "未関連・WBGTなし",
};

export function classifyWbgtZone(wbgtC: number | null | undefined): WbgtZone {
  if (wbgtC == null) {
    return "none";
  }
  if (wbgtC < 10) {
    return "too_cold";
  }
  if (wbgtC < 15) {
    return "cold";
  }
  if (wbgtC < 21) {
    return "comfort";
  }
  if (wbgtC < 28) {
    return "hot";
  }
  return "too_hot";
}

export function runRowClass(run: { hr_zone: string | null; weather_zone: string | null }): string | undefined {
  if (run.weather_zone) {
    return `wbgt-${run.weather_zone}`;
  }
  if (run.hr_zone) {
    return `zone-${run.hr_zone}`;
  }
  return undefined;
}

export function normalizeRowColorMode(value: string | null | undefined, fallback: RowColorMode = "hr"): RowColorMode {
  if (value === "hr" || value === "wbgt" || value === "off") {
    return value;
  }
  return fallback;
}
