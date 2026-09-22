import { NextResponse } from "next/server";
import { INTENSITY_LABELS, RACE_DISTANCES_KM } from "../../../lib/intensity";
import { requireUser } from "../../../lib/server/auth";
import { parseDateTimeLocal, formatDateTimeSpace } from "../../../lib/server/datetime";
import { ApiError, toErrorResponse } from "../../../lib/server/errors";
import { fetchForecastCondition } from "../../../lib/server/forecast";
import { getOrCreateProfile, intensityLabel, resolveTargetHr } from "../../../lib/server/profile";
import { predictPerformance } from "../../../lib/server/prediction";
import { loadPredictRuns } from "../../../lib/server/runs";
import { resolveStation } from "../../../lib/server/amedas";
import { targetWbgt } from "../../../lib/server/weather";

export const runtime = "nodejs";
export const maxDuration = 60;

const WEATHER_DISTANCE_HELP =
  "予測対象の推定 WBGT と、その走の推定 WBGT の差です。" +
  "過去走のほうが高い（暑い）と +、低い（涼しい）と - を付けます。" +
  "0 に近いほど条件が似ています。単位は ℃ です。";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      distance_km?: number | null;
      distance_mode?: string;
      race?: string | null;
      mode?: string;
      temperature_c?: number | null;
      humidity_pct?: number | null;
      forecast_at?: string | null;
      intensity?: string;
      amedas_station_id?: string | null;
    };
    const profile = await getOrCreateProfile(user);
    const station = await resolveStation(payload.amedas_station_id || profile.amedas_station_id);
    let temperature: number;
    let humidity: number;
    let wbgt: number;
    let condition = null;

    if (payload.mode === "forecast") {
      if (!payload.forecast_at) {
        throw new ApiError(400, "予報を使う日時を入力してください");
      }
      const forecast = await fetchForecastCondition(
        parseDateTimeLocal(payload.forecast_at),
        station.latitude,
        station.longitude,
        station.name,
      );
      temperature = forecast.temperatureC;
      humidity = forecast.humidityPct;
      wbgt = await targetWbgt(temperature, humidity, forecast.observedAt, station, forecast);
      condition = {
        observed_at: formatDateTimeSpace(forecast.observedAt),
        temperature_c: forecast.temperatureC,
        humidity_pct: forecast.humidityPct,
        location_label: forecast.locationLabel,
        wind_ms: forecast.windMs,
        wind_dir_deg: forecast.windDirDeg ?? null,
        solar_wm2: forecast.solarWm2,
        weather_code: forecast.weatherCode ?? null,
        wbgt_c: wbgt,
      };
    } else {
      if (payload.temperature_c == null || payload.humidity_pct == null) {
        throw new ApiError(400, "気温と湿度を入力してください");
      }
      temperature = payload.temperature_c;
      humidity = payload.humidity_pct;
      if (!(humidity >= 0 && humidity <= 100)) {
        throw new ApiError(400, "湿度は 0〜100 の範囲で入力してください");
      }
      wbgt = await targetWbgt(temperature, humidity, new Date(), station);
    }

    let distance: number;
    let intensityKey: string;
    if (payload.distance_mode === "race") {
      const raceKey = payload.race || "race_5k";
      if (!(raceKey in RACE_DISTANCES_KM)) {
        throw new ApiError(400, "レース種目の指定が正しくありません");
      }
      distance = RACE_DISTANCES_KM[raceKey];
      intensityKey = raceKey;
    } else {
      if (payload.distance_km == null) {
        throw new ApiError(400, "距離は 0 より大きくしてください");
      }
      distance = payload.distance_km;
      intensityKey = payload.intensity || "medium";
      if (!["low", "medium", "high"].includes(intensityKey)) {
        throw new ApiError(400, "走行強度の指定が正しくありません");
      }
    }

    const targetHr = resolveTargetHr(profile, intensityKey);
    const result = predictPerformance(await loadPredictRuns(user.id), wbgt, distance, {
      intensityKey,
      intensityLabel: intensityLabel(intensityKey) || INTENSITY_LABELS[intensityKey] || intensityKey,
      targetHr,
    });
    if (result == null) {
      throw new ApiError(400, "WBGT が付いた走行記録がまだ無いため、予測できません");
    }

    return NextResponse.json({
      predicted_pace_sec_per_km: result.predictedPaceSecPerKm,
      predicted_duration_sec: result.predictedDurationSec,
      predicted_heart_rate: result.predictedHeartRate,
      confidence: result.confidence,
      sample_count: result.sampleCount,
      near_count: result.nearCount,
      intensity_key: result.intensityKey,
      intensity_label: result.intensityLabel,
      used_runs: result.usedRuns.map((item) => ({
        record_id: item.recordId,
        started_at: item.startedAt,
        distance_km: item.distanceKm,
        duration_sec: item.durationSec,
        pace_sec_per_km: item.paceSecPerKm,
        avg_heart_rate: item.avgHeartRate,
        temperature_c: item.temperatureC,
        humidity_pct: item.humidityPct,
        wbgt_c: item.wbgtC,
        weather_distance: item.weatherDistance,
        wbgt_delta: item.wbgtDelta,
      })),
      condition,
      weather_distance_help: WEATHER_DISTANCE_HELP,
      r_squared: result.rSquared,
      rmse_sec_per_km: result.rmseSecPerKm,
      model_formula: result.modelFormula,
      uses_hr: result.usesHr,
      relation_charts: result.relationCharts.map((chart) => ({
        key: chart.key,
        title: chart.title,
        x_label: chart.xLabel,
        note: chart.note,
        observed: chart.observed.map((point) => ({ x: point.x, pace_sec_per_km: point.paceSecPerKm })),
        curve: chart.curve.map((point) => ({ x: point.x, pace_sec_per_km: point.paceSecPerKm })),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
