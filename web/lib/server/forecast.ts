import {
  DEFAULT_LATITUDE,
  DEFAULT_LOCATION,
  DEFAULT_LONGITUDE,
  DEFAULT_TIMEZONE,
  MATCH_MAX_DELTA_MINUTES,
} from "../constants";

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
export const HOURLY_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation";

export type ForecastCondition = {
  observedAt: Date;
  temperatureC: number;
  humidityPct: number;
  windMs: number | null;
  solarWm2: number | null;
  locationLabel: string;
};

export class ForecastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForecastError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumberArray(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (item == null ? null : Number(item)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function parseHourlyTime(text: string): Date {
  const normalized = text.length === 16 ? `${text}:00` : text;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(`${normalized}+09:00`);
}

function formatTokyoDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function toNumberOrNull(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function pickNearest(
  times: string[],
  temperatures: Array<number | null>,
  humidities: Array<number | null>,
  winds: Array<number | null>,
  solars: Array<number | null>,
  targetAt: Date,
  locationLabel: string,
): ForecastCondition {
  let bestIndex: number | null = null;
  let bestDelta: number | null = null;
  for (let index = 0; index < times.length; index++) {
    if (index >= temperatures.length || index >= humidities.length) {
      continue;
    }
    if (temperatures[index] == null || humidities[index] == null) {
      continue;
    }
    const moment = parseHourlyTime(times[index]);
    const delta = Math.abs(moment.getTime() - targetAt.getTime()) / 1000;
    if (bestDelta == null || delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  if (bestIndex == null || bestDelta == null) {
    throw new ForecastError("指定日時の気象が見つかりませんでした");
  }
  if (bestDelta > MATCH_MAX_DELTA_MINUTES * 60) {
    throw new ForecastError("指定日時は取得対象の期間外です");
  }

  const wind = bestIndex < winds.length ? winds[bestIndex] : null;
  const solar = bestIndex < solars.length ? solars[bestIndex] : null;
  return {
    observedAt: parseHourlyTime(times[bestIndex]),
    temperatureC: Number(temperatures[bestIndex]),
    humidityPct: Number(humidities[bestIndex]),
    windMs: toNumberOrNull(wind),
    solarWm2: toNumberOrNull(solar),
    locationLabel,
  };
}

function parseHourlyPayload(
  payload: unknown,
  targetAt: Date,
  locationLabel: string,
): ForecastCondition {
  const hourly = isRecord(payload) && isRecord(payload.hourly) ? payload.hourly : {};
  const times = asStringArray(hourly.time);
  const temperatures = asNumberArray(hourly.temperature_2m);
  const humidities = asNumberArray(hourly.relative_humidity_2m);
  const winds = asNumberArray(hourly.wind_speed_10m);
  const solars = asNumberArray(hourly.shortwave_radiation);
  if (!times.length || times.length !== temperatures.length || times.length !== humidities.length) {
    throw new ForecastError("気象データの形式を解釈できませんでした");
  }
  return pickNearest(times, temperatures, humidities, winds, solars, targetAt, locationLabel);
}

async function fetchJson(url: URL, timeoutMs: number, errorMessage: string): Promise<unknown> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      throw new ForecastError(errorMessage);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ForecastError) {
      throw error;
    }
    throw new ForecastError(errorMessage);
  }
}

function forecastParams(latitude: number, longitude: number): URLSearchParams {
  return new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY_VARS,
    timezone: DEFAULT_TIMEZONE,
    wind_speed_unit: "ms",
  });
}

export async function fetchForecastCondition(
  targetAt: Date,
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  locationLabel = DEFAULT_LOCATION,
): Promise<ForecastCondition> {
  const params = forecastParams(latitude, longitude);
  params.set("forecast_days", "16");
  params.set("past_days", "7");
  const url = new URL(FORECAST_URL);
  url.search = params.toString();
  const payload = await fetchJson(url, 20_000, "天気予報の取得に失敗しました");
  return parseHourlyPayload(payload, targetAt, locationLabel);
}

export async function fetchArchiveCondition(
  targetAt: Date,
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  locationLabel = DEFAULT_LOCATION,
): Promise<ForecastCondition> {
  const day = formatTokyoDate(targetAt);
  const params = forecastParams(latitude, longitude);
  params.set("start_date", day);
  params.set("end_date", day);
  const url = new URL(ARCHIVE_URL);
  url.search = params.toString();
  const payload = await fetchJson(url, 30_000, "過去気象の取得に失敗しました");
  return parseHourlyPayload(payload, targetAt, locationLabel);
}

export async function fetchArchiveRange(
  startDay: Date,
  endDay: Date,
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  locationLabel = DEFAULT_LOCATION,
): Promise<ForecastCondition[]> {
  const params = forecastParams(latitude, longitude);
  params.set("start_date", formatTokyoDate(startDay));
  params.set("end_date", formatTokyoDate(endDay));
  const url = new URL(ARCHIVE_URL);
  url.search = params.toString();
  const payload = await fetchJson(url, 60_000, "過去気象の取得に失敗しました");
  const hourly = isRecord(payload) && isRecord(payload.hourly) ? payload.hourly : {};
  const times = asStringArray(hourly.time);
  const temperatures = asNumberArray(hourly.temperature_2m);
  const humidities = asNumberArray(hourly.relative_humidity_2m);
  const winds = asNumberArray(hourly.wind_speed_10m);
  const solars = asNumberArray(hourly.shortwave_radiation);
  const rows: ForecastCondition[] = [];
  for (let index = 0; index < times.length; index++) {
    if (index >= temperatures.length || index >= humidities.length) {
      continue;
    }
    if (temperatures[index] == null || humidities[index] == null) {
      continue;
    }
    const wind = index < winds.length ? winds[index] : null;
    const solar = index < solars.length ? solars[index] : null;
    rows.push({
      observedAt: parseHourlyTime(times[index]),
      temperatureC: Number(temperatures[index]),
      humidityPct: Number(humidities[index]),
      windMs: toNumberOrNull(wind),
      solarWm2: toNumberOrNull(solar),
      locationLabel,
    });
  }
  return rows;
}

export async function fetchConditionForTime(
  targetAt: Date,
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  locationLabel = DEFAULT_LOCATION,
): Promise<ForecastCondition> {
  const now = new Date();
  const recentStart = new Date(now.getTime() - 6 * 86400000);
  if (targetAt.getTime() >= recentStart.getTime()) {
    try {
      return await fetchForecastCondition(targetAt, latitude, longitude, locationLabel);
    } catch (error) {
      if (!(error instanceof ForecastError) || targetAt.getTime() > now.getTime()) {
        throw error;
      }
    }
  }
  return fetchArchiveCondition(targetAt, latitude, longitude, locationLabel);
}

export type ForecastHourRow = {
  observedAt: Date;
  temperatureC: number;
  humidityPct: number;
  windMs: number | null;
  windDirDeg: number | null;
  solarWm2: number | null;
  weatherCode: number | null;
};

export async function fetchForecastHours(
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  forecastDays = 3,
): Promise<ForecastHourRow[]> {
  const params = forecastParams(latitude, longitude);
  params.set("hourly", `${HOURLY_VARS},wind_direction_10m,weather_code`);
  params.set("forecast_days", String(forecastDays));
  const url = new URL(FORECAST_URL);
  url.search = params.toString();
  const payload = await fetchJson(url, 20_000, "天気予報の取得に失敗しました");
  const hourly = isRecord(payload) && isRecord(payload.hourly) ? payload.hourly : {};
  const times = asStringArray(hourly.time);
  const temperatures = asNumberArray(hourly.temperature_2m);
  const humidities = asNumberArray(hourly.relative_humidity_2m);
  const winds = asNumberArray(hourly.wind_speed_10m);
  const windDirs = asNumberArray(hourly.wind_direction_10m);
  const solars = asNumberArray(hourly.shortwave_radiation);
  const codes = asNumberArray(hourly.weather_code);
  const rows: ForecastHourRow[] = [];
  for (let index = 0; index < times.length; index++) {
    if (index >= temperatures.length || index >= humidities.length) {
      continue;
    }
    if (temperatures[index] == null || humidities[index] == null) {
      continue;
    }
    const wind = index < winds.length ? winds[index] : null;
    const windDir = index < windDirs.length ? windDirs[index] : null;
    const solar = index < solars.length ? solars[index] : null;
    const code = index < codes.length ? codes[index] : null;
    rows.push({
      observedAt: parseHourlyTime(times[index]),
      temperatureC: Number(temperatures[index]),
      humidityPct: Number(humidities[index]),
      windMs: toNumberOrNull(wind),
      windDirDeg: toNumberOrNull(windDir),
      solarWm2: toNumberOrNull(solar),
      weatherCode: toNumberOrNull(code),
    });
  }
  return rows;
}

export function nearestCondition(
  rows: ForecastCondition[],
  targetAt: Date,
): ForecastCondition | null {
  let best: ForecastCondition | null = null;
  let bestDelta: number | null = null;
  const limit = MATCH_MAX_DELTA_MINUTES * 60;
  for (const row of rows) {
    const delta = Math.abs(row.observedAt.getTime() - targetAt.getTime()) / 1000;
    if (delta > limit) {
      continue;
    }
    if (bestDelta == null || delta < bestDelta) {
      best = row;
      bestDelta = delta;
    }
  }
  return best;
}
