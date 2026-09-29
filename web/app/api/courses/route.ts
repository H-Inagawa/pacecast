import { NextResponse } from "next/server";
import { ApiError, toErrorResponse } from "../../../lib/server/errors";
import { requireUser } from "../../../lib/server/auth";
import { CourseRouteError, proposeCourses } from "../../../lib/server/courseRoutes";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      distance_km?: number;
      latitude?: number;
      longitude?: number;
      intensity?: string;
    };
    const distance = payload.distance_km;
    if (distance == null || !(distance >= 1 && distance <= 50)) {
      throw new ApiError(400, "距離は 1〜50km で入力してください");
    }
    if (payload.latitude == null || payload.longitude == null) {
      throw new ApiError(400, "起点を、現在地か地図のタップで決めてください");
    }
    if (!(payload.latitude >= -90 && payload.latitude <= 90 && payload.longitude >= -180 && payload.longitude <= 180)) {
      throw new ApiError(400, "起点の位置が正しくありません");
    }
    const intensity = payload.intensity || "medium";
    if (!["low", "medium", "high"].includes(intensity)) {
      throw new ApiError(400, "走行強度の指定が正しくありません");
    }
    const proposed = await proposeCourses(
      user,
      { lat: payload.latitude, lon: payload.longitude },
      distance,
      intensity,
    );
    return NextResponse.json({
      station_name: proposed.stationName,
      courses: proposed.courses.map((course, index) => ({
        id: String(index + 1),
        distance_km: course.distanceKm,
        coordinates: course.coordinates.map((point) => ({ lat: point.lat, lon: point.lon })),
        turn_count: course.turnCount,
        signal_count: course.signalCount,
        ascent_m: course.ascentM,
        descent_m: course.descentM,
        prediction: course.prediction
          ? {
              pace_sec_per_km: course.prediction.paceSecPerKm,
              duration_sec: course.prediction.durationSec,
              rmse_sec_per_km: course.prediction.rmseSecPerKm,
              confidence: course.prediction.confidence,
              sample_count: course.prediction.sampleCount,
              r_squared: course.prediction.rSquared,
            }
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof CourseRouteError) {
      return NextResponse.json({ detail: error.message }, { status: 502 });
    }
    return toErrorResponse(error);
  }
}
