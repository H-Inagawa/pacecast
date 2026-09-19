import { DEFAULT_LOCATION, SAMPLE_AMEDAS_STATION_ID, WBGT_METHOD } from "../constants";
import { estimateWbgt, fallbackSolarWm2, fallbackWindMs } from "../wbgt";
import type { AmedasStation } from "./amedas";
import { fetchMapObservation, resolveStation } from "./amedas";
import { parseDbTimestamp, toDbTimestamp, tokyoParts } from "./datetime";
import { ApiError } from "./errors";
import {
  ForecastError,
  fetchArchiveRange,
  fetchConditionForTime,
  nearestCondition,
  type ForecastCondition,
} from "./forecast";
import { findNearestWeatherRow } from "./matching";
import { getServiceClient, requireData } from "./supabase";
import type { ProfileRow, RunRow, WeatherRow } from "./types";
import { effectiveWeather, runEndedAt, shouldAverageWeatherSpan } from "../weather-span";

function applyWbgt(row: WeatherRow): boolean {
  if (row.temperature_c == null || row.humidity_pct == null || row.wind_ms == null || row.solar_wm2 == null) {
    row.wbgt_c = null;
    row.wbgt_method = null;
    return false;
  }
  row.wbgt_c = estimateWbgt(row.temperature_c, row.humidity_pct, row.solar_wm2, row.wind_ms);
  row.wbgt_method = WBGT_METHOD;
  return true;
}

function isMissingColumn(message: string, column: string): boolean {
  const text = message.toLowerCase();
  return text.includes(column.toLowerCase()) && (text.includes("schema cache") || text.includes("does not exist"));
}

async function fetchWeatherWindow(from: Date, to: Date = from): Promise<WeatherRow[]> {
  const client = getServiceClient();
  const start = new Date(from.getTime() - 90 * 60 * 1000);
  const end = new Date(to.getTime() + 90 * 60 * 1000);
  const result = await client
    .from("weather_observations")
    .select("*")
    .gte("observed_at", toDbTimestamp(start))
    .lte("observed_at", toDbTimestamp(end))
    .order("observed_at", { ascending: true });
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  return (result.data as WeatherRow[]) ?? [];
}

export async function findNearestWeather(startedAt: Date, stationId?: string | null): Promise<WeatherRow | null> {
  const rows = await fetchWeatherWindow(startedAt);
  return findNearestWeatherRow(rows, startedAt, stationId);
}

function nestedWeather(value: RunRow["weather"] | RunRow["weather_end"]): WeatherRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as WeatherRow | undefined) ?? null;
  }
  return value;
}

export async function fillMissingEndWeather(records: RunRow[]): Promise<void> {
  const pending: Array<{ record: RunRow; endedAt: Date }> = [];
  for (const record of records) {
    if (nestedWeather(record.weather_end)) {
      continue;
    }
    const startedAt = parseDbTimestamp(record.started_at);
    const endedAt = runEndedAt(startedAt, record.duration_sec);
    if (!shouldAverageWeatherSpan(record.duration_sec)) {
      continue;
    }
    pending.push({ record, endedAt });
  }
  if (pending.length === 0) {
    return;
  }
  const windows = new Map<string, WeatherRow[]>();
  for (const { record, endedAt } of pending) {
    const key = toDbTimestamp(endedAt);
    let rows = windows.get(key);
    if (!rows) {
      rows = await fetchWeatherWindow(endedAt);
      windows.set(key, rows);
    }
    const end = findNearestWeatherRow(rows, endedAt, record.amedas_station_id);
    const start = nestedWeather(record.weather);
    record.weather_end = start != null && end != null && end.id !== start.id ? end : null;
  }
}

async function linkRunWeather(record: RunRow, start: WeatherRow | null, end: WeatherRow | null): Promise<void> {
  const client = getServiceClient();
  const values: Record<string, number | null> = {
    weather_observation_id: start?.id ?? null,
    weather_end_observation_id: start != null && end != null && end.id !== start.id ? end.id : null,
  };
  let updated = await client.from("running_records").update(values).eq("id", record.id).select("*").single();
  if (updated.error && isMissingColumn(updated.error.message, "weather_end_observation_id")) {
    const { weather_end_observation_id: _ignored, ...startOnly } = values;
    updated = await client.from("running_records").update(startOnly).eq("id", record.id).select("*").single();
  }
  const saved = (await requireData(updated)) as RunRow;
  record.weather_observation_id = saved.weather_observation_id;
  record.weather_end_observation_id = saved.weather_end_observation_id ?? null;
  record.weather = start;
  record.weather_end = start != null && end != null && end.id !== start.id ? end : null;
}

async function upsertWeather(input: {
  observedAt: Date;
  location: string;
  stationId: string;
  temperatureC: number;
  humidityPct: number;
  windMs: number | null;
  solarWm2: number | null;
  source: string;
}): Promise<WeatherRow> {
  const client = getServiceClient();
  const observedAt = toDbTimestamp(input.observedAt);
  const existingResult = await client
    .from("weather_observations")
    .select("*")
    .eq("observed_at", observedAt)
    .eq("station_id", input.stationId)
    .maybeSingle();
  if (existingResult.error) {
    throw new ApiError(500, existingResult.error.message);
  }
  let row = (existingResult.data as WeatherRow | null) ?? null;
  const now = toDbTimestamp(new Date());
  if (row == null && input.stationId === SAMPLE_AMEDAS_STATION_ID) {
    const legacy = await client
      .from("weather_observations")
      .select("*")
      .eq("observed_at", observedAt)
      .is("station_id", null)
      .maybeSingle();
    if (legacy.error) {
      throw new ApiError(500, legacy.error.message);
    }
    row = (legacy.data as WeatherRow | null) ?? null;
  }
  if (row == null) {
    row = {
      id: 0,
      observed_at: observedAt,
      location: input.location,
      temperature_c: input.temperatureC,
      humidity_pct: input.humidityPct,
      temperature_quality: null,
      humidity_quality: null,
      wind_ms: input.windMs,
      solar_wm2: input.solarWm2,
      wbgt_c: null,
      wbgt_method: null,
      station_id: input.stationId,
      source: input.source,
      imported_at: now,
    };
  } else {
    row.location = input.location;
    row.temperature_c = input.temperatureC;
    row.humidity_pct = input.humidityPct;
    row.imported_at = now;
    if (!row.source || !row.source.includes(input.source)) {
      row.source = input.source;
    }
    row.station_id = input.stationId;
    if (input.windMs != null) {
      row.wind_ms = input.windMs;
    }
    if (input.solarWm2 != null) {
      row.solar_wm2 = input.solarWm2;
    }
  }
  applyWbgt(row);
  if (row.id === 0) {
    const inserted = await client
      .from("weather_observations")
      .insert({
        observed_at: row.observed_at,
        location: row.location,
        temperature_c: row.temperature_c,
        humidity_pct: row.humidity_pct,
        wind_ms: row.wind_ms,
        solar_wm2: row.solar_wm2,
        wbgt_c: row.wbgt_c,
        wbgt_method: row.wbgt_method,
        station_id: row.station_id,
        source: row.source,
        imported_at: row.imported_at,
      })
      .select("*")
      .single();
    return (await requireData(inserted)) as WeatherRow;
  }
  const updated = await client
    .from("weather_observations")
    .update({
      location: row.location,
      temperature_c: row.temperature_c,
      humidity_pct: row.humidity_pct,
      wind_ms: row.wind_ms,
      solar_wm2: row.solar_wm2,
      wbgt_c: row.wbgt_c,
      wbgt_method: row.wbgt_method,
      station_id: row.station_id,
      source: row.source,
      imported_at: row.imported_at,
    })
    .eq("id", row.id)
    .select("*")
    .single();
  return (await requireData(updated)) as WeatherRow;
}

function fillFromCondition(
  row: WeatherRow,
  condition: ForecastCondition,
  station: AmedasStation,
  overwriteTempHumidity: boolean,
): void {
  if (overwriteTempHumidity) {
    row.temperature_c = condition.temperatureC;
    row.humidity_pct = condition.humidityPct;
  }
  if (row.wind_ms == null && condition.windMs != null) {
    row.wind_ms = condition.windMs;
  }
  if (row.solar_wm2 == null && condition.solarWm2 != null) {
    row.solar_wm2 = condition.solarWm2;
  }
  row.station_id = station.stationId;
  if (!row.location) {
    row.location = station.name;
  }
  applyWbgt(row);
}

async function persistWeather(row: WeatherRow): Promise<WeatherRow> {
  const client = getServiceClient();
  const updated = await client
    .from("weather_observations")
    .update({
      location: row.location,
      temperature_c: row.temperature_c,
      humidity_pct: row.humidity_pct,
      wind_ms: row.wind_ms,
      solar_wm2: row.solar_wm2,
      wbgt_c: row.wbgt_c,
      wbgt_method: row.wbgt_method,
      station_id: row.station_id,
    })
    .eq("id", row.id)
    .select("*")
    .single();
  return (await requireData(updated)) as WeatherRow;
}

export async function enrichWeatherRow(
  row: WeatherRow,
  station: AmedasStation,
  hourly: ForecastCondition[] | null = null,
): Promise<{ row: WeatherRow; ok: boolean }> {
  if (row.wbgt_c != null) {
    return { row, ok: true };
  }
  const observedAt = parseDbTimestamp(row.observed_at);
  if (observedAt.getTime() >= Date.now() - 8 * 86400000) {
    const amedas = await fetchMapObservation(station.stationId, observedAt);
    if (amedas != null) {
      if (row.wind_ms == null && amedas.windMs != null) {
        row.wind_ms = amedas.windMs;
      }
      if (row.solar_wm2 == null && amedas.solarWm2 != null) {
        row.solar_wm2 = amedas.solarWm2;
      }
      row.station_id = station.stationId;
    }
  }
  let condition = hourly ? nearestCondition(hourly, observedAt) : null;
  if (condition == null) {
    try {
      condition = await fetchConditionForTime(observedAt, station.latitude, station.longitude, station.name);
    } catch (error) {
      if (!(error instanceof ForecastError)) {
        throw error;
      }
      condition = null;
    }
  }
  if (condition != null) {
    fillFromCondition(row, condition, station, false);
  }
  if (row.wind_ms == null) {
    row.wind_ms = fallbackWindMs();
  }
  if (row.solar_wm2 == null) {
    row.solar_wm2 = fallbackSolarWm2(tokyoParts(observedAt).hour);
  }
  const ok = applyWbgt(row);
  return { row: await persistWeather(row), ok };
}

async function ensureWeatherAt(
  at: Date,
  station: AmedasStation,
  hourly: ForecastCondition[] | null,
): Promise<WeatherRow | null> {
  let weather = await findNearestWeather(at, station.stationId);
  if (weather == null) {
    let condition = hourly ? nearestCondition(hourly, at) : null;
    if (condition == null) {
      try {
        condition = await fetchConditionForTime(at, station.latitude, station.longitude, station.name);
      } catch (error) {
        if (!(error instanceof ForecastError)) {
          throw error;
        }
        condition = null;
      }
    }
    if (condition == null) {
      return null;
    }
    weather = await upsertWeather({
      observedAt: condition.observedAt,
      location: station.name || DEFAULT_LOCATION,
      stationId: station.stationId,
      temperatureC: condition.temperatureC,
      humidityPct: condition.humidityPct,
      windMs: condition.windMs,
      solarWm2: condition.solarWm2,
      source: "open-meteo",
    });
  }
  const enriched = await enrichWeatherRow(weather, station, hourly);
  return enriched.row;
}

export async function enrichRunWeather(
  record: RunRow,
  station: AmedasStation,
  hourly: ForecastCondition[] | null = null,
): Promise<boolean> {
  const startedAt = parseDbTimestamp(record.started_at);
  const endedAt = runEndedAt(startedAt, record.duration_sec);
  const start = await ensureWeatherAt(startedAt, station, hourly);
  const end = shouldAverageWeatherSpan(record.duration_sec) ? await ensureWeatherAt(endedAt, station, hourly) : null;
  await linkRunWeather(record, start, end);
  const effective = effectiveWeather(start, end);
  return effective != null && effective.wbgt_c != null;
}

export async function targetWbgt(
  temperatureC: number,
  humidityPct: number,
  at: Date | null,
  station: AmedasStation,
  prefer: ForecastCondition | null = null,
): Promise<number> {
  const moment = at ?? new Date();
  let wind = prefer?.windMs ?? null;
  let solar = prefer?.solarWm2 ?? null;
  if (wind == null || solar == null) {
    try {
      const fetched = await fetchConditionForTime(moment, station.latitude, station.longitude, station.name);
      wind = wind ?? fetched.windMs;
      solar = solar ?? fetched.solarWm2;
    } catch (error) {
      if (!(error instanceof ForecastError)) {
        throw error;
      }
    }
  }
  if (wind == null) {
    wind = fallbackWindMs();
  }
  if (solar == null) {
    solar = fallbackSolarWm2(tokyoParts(moment).hour);
  }
  return estimateWbgt(temperatureC, humidityPct, solar, wind);
}

export async function backfillRunWbgt(profile: ProfileRow): Promise<void> {
  const station = await resolveStation(profile.amedas_station_id);
  const client = getServiceClient();
  const modern =
    "*, weather:weather_observations!running_records_weather_observation_id_fkey(*), weather_end:weather_observations!running_records_weather_end_observation_id_fkey(*)";
  const legacy = "*, weather:weather_observations(*)";
  const fetchRows = async (columns: string) => {
    let query = client.from("running_records").select(columns).order("started_at", { ascending: true });
    if (profile.auth_user_id != null) {
      query = query.eq("auth_user_id", profile.auth_user_id);
    }
    return query;
  };
  let result = await fetchRows(modern);
  if (
    result.error &&
    (isMissingColumn(result.error.message, "weather_end_observation_id") ||
      result.error.message.toLowerCase().includes("relationship"))
  ) {
    result = await fetchRows(legacy);
  }
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  const records = (result.data as RunRow[]) ?? [];
  if (records.length === 0) {
    return;
  }
  let hourly: ForecastCondition[] = [];
  const startDay = parseDbTimestamp(records[0].started_at);
  const endDay = records.reduce((latest, record) => {
    const ended = runEndedAt(parseDbTimestamp(record.started_at), record.duration_sec);
    return ended.getTime() > latest.getTime() ? ended : latest;
  }, parseDbTimestamp(records[records.length - 1].started_at));
  try {
    hourly = await fetchArchiveRange(
      startDay,
      endDay,
      station.latitude,
      station.longitude,
      station.name,
    );
  } catch (error) {
    if (!(error instanceof ForecastError)) {
      throw error;
    }
    hourly = [];
  }
  for (const record of records) {
    await enrichRunWeather(record, station, hourly.length > 0 ? hourly : null);
  }
}
