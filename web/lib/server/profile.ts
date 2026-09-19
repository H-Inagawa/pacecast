import {
  DEFAULT_AMEDAS_STATION_ID,
  DEFAULT_AMEDAS_STATION_NAME,
} from "../constants";
import {
  INTENSITY_LABELS,
  PROFILE_HR_FIELDS,
  classifyRunZone,
  listCustomIntensities,
  raceOptions,
  suggestedIntensityHrs,
} from "../intensity";
import { classifyWbgtZone } from "../weatherZone";
import { profileNeedsOnboarding } from "../onboarding";
import type { IntensityHrs, Profile } from "../types";
import { ApiError } from "./errors";
import { getServiceClient, requireData } from "./supabase";
import { toDbTimestamp, tokyoParts, tokyoTodayNoon } from "./datetime";
import type { AuthUserRow, ProfileRow } from "./types";
import { resolveStation } from "./amedas";

const ROW_COLOR_MODES = new Set(["hr", "wbgt", "off"]);

export type IntensityHrsMap = Record<string, number | null>;

export function profileTargetHrs(profile: ProfileRow): IntensityHrsMap {
  const values: IntensityHrsMap = {};
  for (const [key, field] of Object.entries(PROFILE_HR_FIELDS)) {
    values[key] = (profile[field as keyof ProfileRow] as number | null) ?? null;
  }
  return values;
}

export function normalizeRowColorMode(mode: string | null | undefined, colorRows?: boolean | null): string {
  if (mode && ROW_COLOR_MODES.has(mode)) {
    return mode;
  }
  return colorRows ? "hr" : "off";
}

export function effectiveRowColorMode(profile: ProfileRow): "hr" | "wbgt" | "off" {
  const mode = normalizeRowColorMode(profile.row_color_mode, profile.color_rows);
  if (mode === "hr" && !profile.max_heart_rate) {
    return "off";
  }
  return mode as "hr" | "wbgt" | "off";
}

export function effectiveColorRows(profile: ProfileRow): boolean {
  return effectiveRowColorMode(profile) === "hr";
}

export function runZone(profile: ProfileRow, avgHeartRate: number | null): "low" | "medium" | "high" | null {
  return classifyRunZone(avgHeartRate, profile.max_heart_rate, effectiveColorRows(profile));
}

export function runWeatherZone(
  profile: ProfileRow,
  wbgtC: number | null,
  hasWeather: boolean,
): ReturnType<typeof classifyWbgtZone> | "none" | null {
  if (effectiveRowColorMode(profile) !== "wbgt") {
    return null;
  }
  if (!hasWeather || wbgtC == null) {
    return "none";
  }
  return classifyWbgtZone(wbgtC);
}

export function resolveTargetHr(profile: ProfileRow, intensityKey: string): number | null {
  const stored = profileTargetHrs(profile)[intensityKey];
  if (stored != null) {
    return stored;
  }
  if (profile.max_heart_rate) {
    return suggestedIntensityHrs(profile.max_heart_rate)[intensityKey] ?? null;
  }
  return null;
}

export function profileAge(profile: ProfileRow): number | null {
  if (!profile.birthday) {
    return null;
  }
  const birth = tokyoParts(new Date(`${profile.birthday}T00:00:00+09:00`));
  const today = tokyoParts(tokyoTodayNoon());
  let years = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    years -= 1;
  }
  return Math.max(years, 0);
}

function toIntensityHrs(values: IntensityHrsMap): IntensityHrs {
  return {
    low: values.low ?? null,
    medium: values.medium ?? null,
    high: values.high ?? null,
    race_5k: values.race_5k ?? null,
    race_10k: values.race_10k ?? null,
    race_half: values.race_half ?? null,
    race_full: values.race_full ?? null,
  };
}

async function wbgtCounts(authUserId: number | null): Promise<{ runCount: number; ready: number }> {
  if (authUserId == null) {
    return { runCount: 0, ready: 0 };
  }
  const client = getServiceClient();
  const runs = await client
    .from("running_records")
    .select("id, weather:weather_observations(wbgt_c)", { count: "exact" })
    .eq("auth_user_id", authUserId);
  if (runs.error) {
    throw new ApiError(500, runs.error.message);
  }
  const runCount = runs.count ?? (runs.data?.length ?? 0);
  const ready = (runs.data ?? []).filter((row) => {
    const raw = (row as { weather?: { wbgt_c: number | null } | Array<{ wbgt_c: number | null }> | null }).weather;
    const weather = Array.isArray(raw) ? raw[0] : raw;
    return weather != null && weather.wbgt_c != null;
  }).length;
  return { runCount, ready };
}

export async function serializeProfile(profile: ProfileRow): Promise<Profile> {
  const stored = profileTargetHrs(profile);
  const suggested = profile.max_heart_rate ? suggestedIntensityHrs(profile.max_heart_rate) : {};
  const station = await resolveStation(profile.amedas_station_id);
  const { runCount, ready } = await wbgtCounts(profile.auth_user_id);
  const suggestedHrs: IntensityHrsMap = {};
  for (const key of Object.keys(stored)) {
    suggestedHrs[key] = suggested[key] ?? null;
  }
  return {
    display_name: profile.display_name,
    birthday: profile.birthday,
    age: profileAge(profile),
    max_heart_rate: profile.max_heart_rate,
    color_rows: profile.color_rows,
    color_rows_effective: effectiveColorRows(profile),
    row_color_mode: effectiveRowColorMode(profile),
    intensities: toIntensityHrs(stored),
    suggested: toIntensityHrs(suggestedHrs),
    custom_intensities: listCustomIntensities(stored).map((item) => ({
      key: item.key,
      label: item.label,
      target_hr: item.targetHr,
      distance_km: item.distanceKm ?? null,
    })),
    race_options: raceOptions(stored).map((item) => ({
      key: item.key,
      label: item.label,
      target_hr: item.targetHr,
      distance_km: item.distanceKm ?? null,
    })),
    amedas_station_id: station.stationId,
    amedas_station_name: station.name,
    wbgt_ready_count: ready,
    run_count: runCount,
    onboarding_complete: Boolean(profile.display_name?.trim()),
  };
}

export async function getOrCreateProfile(user: AuthUserRow): Promise<ProfileRow> {
  const client = getServiceClient();
  const existing = await client.from("user_profiles").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (existing.error) {
    throw new ApiError(500, existing.error.message);
  }
  if (existing.data) {
    const profile = existing.data as ProfileRow;
    if (profile.amedas_station_id) {
      return profile;
    }
    const updated = await client
      .from("user_profiles")
      .update({
        amedas_station_id: DEFAULT_AMEDAS_STATION_ID,
        amedas_station_name: profile.amedas_station_name || DEFAULT_AMEDAS_STATION_NAME,
        updated_at: toDbTimestamp(new Date()),
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    return (await requireData(updated)) as ProfileRow;
  }
  const inserted = await client
    .from("user_profiles")
    .insert({
      auth_user_id: user.id,
      color_rows: true,
      row_color_mode: "hr",
      amedas_station_id: DEFAULT_AMEDAS_STATION_ID,
      amedas_station_name: DEFAULT_AMEDAS_STATION_NAME,
      updated_at: toDbTimestamp(new Date()),
    })
    .select("*")
    .single();
  return (await requireData(inserted)) as ProfileRow;
}

export async function saveProfile(profile: ProfileRow): Promise<ProfileRow> {
  let mode = normalizeRowColorMode(profile.row_color_mode, profile.color_rows);
  if (profile.max_heart_rate == null && mode === "hr") {
    mode = "off";
  }
  const client = getServiceClient();
  const updated = await client
    .from("user_profiles")
    .update({
      display_name: profile.display_name,
      birthday: profile.birthday,
      max_heart_rate: profile.max_heart_rate,
      color_rows: mode === "hr",
      row_color_mode: mode,
      hr_low: profile.hr_low,
      hr_medium: profile.hr_medium,
      hr_high: profile.hr_high,
      hr_race_5k: profile.hr_race_5k,
      hr_race_10k: profile.hr_race_10k,
      hr_race_half: profile.hr_race_half,
      hr_race_full: profile.hr_race_full,
      amedas_station_id: profile.amedas_station_id,
      amedas_station_name: profile.amedas_station_name,
      updated_at: toDbTimestamp(new Date()),
    })
    .eq("id", profile.id)
    .select("*")
    .single();
  return (await requireData(updated)) as ProfileRow;
}

export function intensityLabel(key: string): string {
  return INTENSITY_LABELS[key] ?? key;
}
