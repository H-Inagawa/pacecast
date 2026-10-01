export const FORECAST_OPTIONAL_COLUMNS = ["temperature", "humidity", "wind", "solar"] as const;

export type OptionalForecastColumn = (typeof FORECAST_OPTIONAL_COLUMNS)[number];

export type ForecastColumnVisibility = Record<OptionalForecastColumn, boolean>;

export const DEFAULT_FORECAST_COLUMNS: ForecastColumnVisibility = {
  temperature: false,
  humidity: false,
  wind: false,
  solar: false,
};

export const FORECAST_COLUMNS_STORAGE_KEY = "pacecast.forecastColumns";

export const FORECAST_COLUMN_LABELS: Record<OptionalForecastColumn | "observed_at" | "runnability" | "weather" | "wbgt_feel", string> = {
  observed_at: "日時",
  runnability: "走りやすさ",
  weather: "天気",
  wbgt_feel: "WBGT(体感)",
  temperature: "気温",
  humidity: "湿度",
  wind: "風速",
  solar: "日照",
};

export const FORECAST_REQUIRED_COLUMNS = ["observed_at", "runnability", "weather", "wbgt_feel"] as const;

export function parseForecastColumns(raw: string | null): ForecastColumnVisibility {
  if (!raw) {
    return { ...DEFAULT_FORECAST_COLUMNS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ForecastColumnVisibility> & { feel?: boolean; wbgt?: boolean; weather?: boolean };
    if ("feel" in parsed || "wbgt" in parsed || "weather" in parsed) {
      return { ...DEFAULT_FORECAST_COLUMNS };
    }
    return {
      temperature: parsed.temperature === true,
      humidity: parsed.humidity === true,
      wind: parsed.wind === true,
      solar: parsed.solar === true,
    };
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
