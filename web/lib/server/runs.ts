import type { Run } from "../types";
import { parseDateTimeLocal, parseDbTimestamp, formatDateTimeLocalValue, formatDateTimeSpace, toDbTimestamp } from "./datetime";
import { durationFromHms, splitDuration } from "./duration";
import { ApiError } from "./errors";
import { resolveStation } from "./amedas";
import { getOrCreateProfile, runWeatherZone, runZone } from "./profile";
import { getServiceClient, requireData } from "./supabase";
import type { AuthUserRow, ProfileRow, RunRow, WeatherRow } from "./types";
import { enrichRunWeather } from "./weather";

export type RunWrite = {
  started_at: string;
  distance_km: number;
  hours: number;
  minutes: number;
  seconds: number;
  avg_heart_rate?: number | null;
  notes?: string | null;
  amedas_station_id?: string | null;
};

function nestedWeather(value: RunRow["weather"]): WeatherRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as WeatherRow | undefined) ?? null;
  }
  return value;
}

export function serializeRun(record: RunRow, profile: ProfileRow | null = null): Run {
  const [hours, minutes, seconds] = splitDuration(record.duration_sec);
  const weather = nestedWeather(record.weather);
  return {
    id: record.id,
    started_at: formatDateTimeLocalValue(parseDbTimestamp(record.started_at)),
    distance_km: record.distance_km,
    duration_sec: record.duration_sec,
    hours,
    minutes,
    seconds,
    avg_heart_rate: record.avg_heart_rate,
    notes: record.notes,
    pace_sec_per_km: record.duration_sec / record.distance_km,
    weather: weather
      ? {
          temperature_c: weather.temperature_c,
          humidity_pct: weather.humidity_pct,
          observed_at: formatDateTimeSpace(parseDbTimestamp(weather.observed_at)),
          wbgt_c: weather.wbgt_c,
        }
      : null,
    hr_zone: profile ? runZone(profile, record.avg_heart_rate) : null,
    weather_zone: profile ? runWeatherZone(profile, weather?.wbgt_c ?? null, weather != null) : null,
    amedas_station_id: record.amedas_station_id,
    amedas_station_name: record.amedas_station_name,
  };
}

function applyWrite(payload: RunWrite): {
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  avgHeartRate: number | null;
  notes: string | null;
} {
  const startedAt = parseDateTimeLocal(payload.started_at);
  const durationSec = durationFromHms(payload.hours, payload.minutes, payload.seconds);
  const heartRate = payload.avg_heart_rate ?? null;
  if (heartRate != null && (heartRate < 30 || heartRate > 220)) {
    throw new ApiError(400, "平均心拍数は 30〜220 の範囲で入力してください");
  }
  if (!(payload.distance_km > 0)) {
    throw new ApiError(400, "距離は 0 より大きくしてください");
  }
  return {
    startedAt,
    distanceKm: payload.distance_km,
    durationSec,
    avgHeartRate: heartRate,
    notes: (payload.notes || "").trim() || null,
  };
}

const RUN_SELECT = "*, weather:weather_observations(*)";

export async function listRuns(user: AuthUserRow): Promise<Run[]> {
  const client = getServiceClient();
  const result = await client
    .from("running_records")
    .select(RUN_SELECT)
    .eq("auth_user_id", user.id)
    .order("started_at", { ascending: false });
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  const profile = await getOrCreateProfile(user);
  return ((result.data as RunRow[]) ?? []).map((row) => serializeRun(row, profile));
}

export async function getOwnRun(user: AuthUserRow, runId: number): Promise<RunRow> {
  const client = getServiceClient();
  const result = await client.from("running_records").select(RUN_SELECT).eq("id", runId).maybeSingle();
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  const record = result.data as RunRow | null;
  if (record == null || record.auth_user_id !== user.id) {
    throw new ApiError(404, "記録が見つかりません");
  }
  return record;
}

export async function createRun(user: AuthUserRow, payload: RunWrite): Promise<Run> {
  const values = applyWrite(payload);
  const profile = await getOrCreateProfile(user);
  const station = await resolveStation(payload.amedas_station_id || profile.amedas_station_id);
  const now = toDbTimestamp(new Date());
  const client = getServiceClient();
  const inserted = await client
    .from("running_records")
    .insert({
      started_at: toDbTimestamp(values.startedAt),
      distance_km: values.distanceKm,
      duration_sec: values.durationSec,
      avg_heart_rate: values.avgHeartRate,
      notes: values.notes,
      amedas_station_id: station.stationId,
      amedas_station_name: station.name,
      auth_user_id: user.id,
      created_at: now,
      updated_at: now,
    })
    .select(RUN_SELECT)
    .single();
  const record = (await requireData(inserted)) as RunRow;
  await enrichRunWeather(record, station);
  const refreshed = await getOwnRun(user, record.id);
  return serializeRun(refreshed, profile);
}

export async function updateRun(user: AuthUserRow, runId: number, payload: RunWrite): Promise<Run> {
  const existing = await getOwnRun(user, runId);
  const values = applyWrite(payload);
  const profile = await getOrCreateProfile(user);
  const station = await resolveStation(
    payload.amedas_station_id || existing.amedas_station_id || profile.amedas_station_id,
  );
  const client = getServiceClient();
  const updated = await client
    .from("running_records")
    .update({
      started_at: toDbTimestamp(values.startedAt),
      distance_km: values.distanceKm,
      duration_sec: values.durationSec,
      avg_heart_rate: values.avgHeartRate,
      notes: values.notes,
      amedas_station_id: station.stationId,
      amedas_station_name: station.name,
      updated_at: toDbTimestamp(new Date()),
    })
    .eq("id", existing.id)
    .select(RUN_SELECT)
    .single();
  const record = (await requireData(updated)) as RunRow;
  await enrichRunWeather(record, station);
  const refreshed = await getOwnRun(user, record.id);
  return serializeRun(refreshed, profile);
}

export async function deleteRun(user: AuthUserRow, runId: number): Promise<void> {
  const existing = await getOwnRun(user, runId);
  const client = getServiceClient();
  const result = await client.from("running_records").delete().eq("id", existing.id);
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
}

export async function loadPredictRuns(userId: number) {
  const client = getServiceClient();
  const result = await client
    .from("running_records")
    .select(RUN_SELECT)
    .eq("auth_user_id", userId)
    .order("started_at", { ascending: true });
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  return ((result.data as RunRow[]) ?? [])
    .map((row) => {
      const weather = nestedWeather(row.weather);
      if (weather == null || weather.wbgt_c == null) {
        return null;
      }
      return {
        id: row.id,
        startedAt: parseDbTimestamp(row.started_at),
        distanceKm: row.distance_km,
        durationSec: row.duration_sec,
        avgHeartRate: row.avg_heart_rate,
        temperatureC: weather.temperature_c,
        humidityPct: weather.humidity_pct,
        wbgtC: weather.wbgt_c,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}
