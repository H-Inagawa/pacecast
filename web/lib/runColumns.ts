export const OPTIONAL_RUN_COLUMNS = [
  "duration",
  "pace",
  "heart_rate",
  "temperature",
  "humidity",
  "wbgt",
] as const;

export const RUN_DETAIL_COLUMNS = ["duration", "pace", "heart_rate"] as const;
export const WEATHER_RUN_COLUMNS = ["temperature", "humidity", "wbgt"] as const;

export type OptionalRunColumn = (typeof OPTIONAL_RUN_COLUMNS)[number];

export type RunColumnVisibility = Record<OptionalRunColumn, boolean>;

export const DEFAULT_RUN_COLUMNS: RunColumnVisibility = {
  duration: true,
  pace: true,
  heart_rate: true,
  temperature: true,
  humidity: true,
  wbgt: true,
};

export const RUN_COLUMNS_STORAGE_KEY = "pacecast.runColumns";

export const RUN_COLUMN_LABELS: Record<OptionalRunColumn | "started_at" | "distance", string> = {
  started_at: "日時",
  distance: "距離",
  duration: "走行時間",
  pace: "ペース",
  heart_rate: "平均心拍数",
  temperature: "気温",
  humidity: "湿度",
  wbgt: "WBGT",
};

function visibleFlag(value: boolean | undefined, fallback: boolean): boolean {
  if (value === false) {
    return false;
  }
  if (value === true) {
    return true;
  }
  return fallback;
}

export function parseRunColumns(raw: string | null): RunColumnVisibility {
  if (!raw) {
    return { ...DEFAULT_RUN_COLUMNS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RunColumnVisibility> & { weather?: boolean };
    const legacyWeather = parsed.weather !== false;
    return {
      duration: parsed.duration !== false,
      pace: parsed.pace !== false,
      heart_rate: parsed.heart_rate !== false,
      temperature: visibleFlag(parsed.temperature, legacyWeather),
      humidity: visibleFlag(parsed.humidity, legacyWeather),
      wbgt: visibleFlag(parsed.wbgt, legacyWeather),
    };
  } catch {
    return { ...DEFAULT_RUN_COLUMNS };
  }
}

export function loadRunColumns(): RunColumnVisibility {
  if (typeof window === "undefined") {
    return { ...DEFAULT_RUN_COLUMNS };
  }
  return parseRunColumns(window.localStorage.getItem(RUN_COLUMNS_STORAGE_KEY));
}

export function saveRunColumns(columns: RunColumnVisibility): void {
  window.localStorage.setItem(RUN_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
}
