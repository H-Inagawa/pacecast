import { NextResponse } from "next/server";
import { attachOnboardingCookie, requireUser } from "../../../lib/server/auth";
import { ApiError, toErrorResponse } from "../../../lib/server/errors";
import { getOrCreateProfile, saveProfile, serializeProfile } from "../../../lib/server/profile";
import { resolveStation } from "../../../lib/server/amedas";
import { backfillRunWbgt } from "../../../lib/server/weather";
import type { IntensityHrs } from "../../../lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    const serialized = await serializeProfile(await getOrCreateProfile(user));
    return attachOnboardingCookie(NextResponse.json(serialized), !serialized.onboarding_complete);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      display_name?: string | null;
      birthday?: string | null;
      max_heart_rate?: number | null;
      color_rows?: boolean;
      row_color_mode?: string | null;
      intensities?: Partial<IntensityHrs>;
      amedas_station_id?: string | null;
    };
    const profile = await getOrCreateProfile(user);
    const displayName = (payload.display_name || "").trim();
    if (!displayName || !payload.birthday || !payload.amedas_station_id) {
      throw new ApiError(400, "ユーザー名、アメダス地点、誕生日を入力してください");
    }
    profile.display_name = displayName;
    if (payload.birthday) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.birthday)) {
        throw new ApiError(400, "誕生日の形式が正しくありません");
      }
      profile.birthday = payload.birthday;
    } else {
      profile.birthday = null;
    }
    const maxHr = payload.max_heart_rate ?? null;
    if (maxHr != null && (maxHr < 80 || maxHr > 230)) {
      throw new ApiError(400, "最大心拍数は 80〜230 の範囲で入力してください");
    }
    profile.max_heart_rate = maxHr;
    profile.row_color_mode = payload.row_color_mode ?? profile.row_color_mode;
    profile.color_rows = payload.color_rows ?? profile.color_rows;
    const intensities: Partial<IntensityHrs> = payload.intensities ?? {};
    profile.hr_low = intensities.low ?? null;
    profile.hr_medium = intensities.medium ?? null;
    profile.hr_high = intensities.high ?? null;
    profile.hr_race_5k = intensities.race_5k ?? null;
    profile.hr_race_10k = intensities.race_10k ?? null;
    profile.hr_race_half = intensities.race_half ?? null;
    profile.hr_race_full = intensities.race_full ?? null;

    const previousStation = profile.amedas_station_id;
    if (payload.amedas_station_id) {
      const station = await resolveStation(payload.amedas_station_id);
      profile.amedas_station_id = station.stationId;
      profile.amedas_station_name = station.name;
    }
    const saved = await saveProfile(profile);
    if (payload.amedas_station_id && payload.amedas_station_id !== previousStation) {
      await backfillRunWbgt(saved);
    }
    const serialized = await serializeProfile(saved);
    return attachOnboardingCookie(NextResponse.json(serialized), !serialized.onboarding_complete);
  } catch (error) {
    return toErrorResponse(error);
  }
}
