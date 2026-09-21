export const FORECAST_OPTIONAL_COLUMNS = [
  "weather",
  "feel",
  "wbgt",
  "temperature",
  "humidity",
  "wind",
  "solar",
] as const;

export type OptionalForecastColumn = (typeof FORECAST_OPTIONAL_COLUMNS)[number];

export type ForecastColumnVisibility = Record<OptionalForecastColumn, boolean>;

export const DEFAULT_FORECAST_COLUMNS: ForecastColumnVisibility = {
  weather: true,
  feel: true,
  wbgt: true,
  temperature: true,
  humidity: true,
  wind: true,
  solar: true,
};

export const FORECAST_COLUMNS_STORAGE_KEY = "pacecast.forecastColumns";

export const FORECAST_COLUMN_LABELS: Record<OptionalForecastColumn | "observed_at", string> = {
  observed_at: "日時",
  weather: "天気",
  feel: "体感",
  wbgt: "WBGT",
  temperature: "気温",
  humidity: "湿度",
  wind: "風速",
  solar: "日照",
};

export function parseForecastColumns(raw: string | null): ForecastColumnVisibility {
  if (!raw) {
    return { ...DEFAULT_FORECAST_COLUMNS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ForecastColumnVisibility>;
    const next: ForecastColumnVisibility = {
      weather: parsed.weather !== false,
      feel: parsed.feel !== false,
      wbgt: parsed.wbgt !== false,
      temperature: parsed.temperature !== false,
      humidity: parsed.humidity !== false,
      wind: parsed.wind !== false,
      solar: parsed.solar !== false,
    };
    if (!FORECAST_OPTIONAL_COLUMNS.some((key) => next[key])) {
      return { ...DEFAULT_FORECAST_COLUMNS };
    }
    return next;
  } catch {
    return { ...DEFAULT_FORECAST_COLUMNS };
  }
}

export function loadForecastColumns(): ForecastColumnVisibility {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FORECAST_COLUMNS };
  }
  return parseForecastColumns(window.localStorage.getItem(FORECAST_COLUMNS_STORAGE_KEY));
}

export function saveForecastColumns(columns: ForecastColumnVisibility): void {
  window.localStorage.setItem(FORECAST_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
}

export function visibleForecastCount(columns: ForecastColumnVisibility): number {
  return FORECAST_OPTIONAL_COLUMNS.filter((key) => columns[key]).length;
}
