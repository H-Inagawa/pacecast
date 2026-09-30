import { NextResponse } from "next/server";
import { courseSearchPercent, relativeCourseScores } from "../../../lib/courses";
import { ApiError, toErrorResponse } from "../../../lib/server/errors";
import { requireUser } from "../../../lib/server/auth";
import { CourseRouteError, proposeCourses, type CourseProposalSet } from "../../../lib/server/courseRoutes";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

function coursePayload(proposed: CourseProposalSet) {
  const shown = relativeCourseScores(proposed.courses);
  return {
    courses: shown.map((course, index) => ({
      id: String(index + 1),
      distance_km: course.distanceKm,
      coordinates: course.coordinates.map((point) => ({ lat: point.lat, lon: point.lon })),
      turn_count: course.turnCount,
      signal_count: course.signalCount,
      major_km: course.majorKm,
      overlap_ratio: course.overlapRatio,
      ascent_m: course.ascentM,
      descent_m: course.descentM,
      junction_count: course.junctionCount,
      score: course.score,
      raw_score: course.rawScore,
      score_parts: {
        distance: course.scoreParts.distance,
        major: course.scoreParts.major,
        straight: course.scoreParts.straight,
        turns: course.scoreParts.turns,
        overlap: course.scoreParts.overlap,
        signals: course.scoreParts.signals,
        junctions: course.scoreParts.junctions,
      },
      raw_score_parts: {
        distance: course.rawScoreParts.distance,
        major: course.rawScoreParts.major,
        straight: course.rawScoreParts.straight,
        turns: course.rawScoreParts.turns,
        overlap: course.rawScoreParts.overlap,
        signals: course.rawScoreParts.signals,
        junctions: course.rawScoreParts.junctions,
      },
    })),
  };
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const payload = (await request.json()) as {
      distance_km?: number;
      latitude?: number;
      longitude?: number;
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
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (value: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        };
        try {
          const proposed = await proposeCourses(
            { lat: payload.latitude as number, lon: payload.longitude as number },
            distance,
            (finished, total, passed) => {
              write({ type: "progress", percent: courseSearchPercent(finished, total), passed });
            },
          );
          write({ type: "result", ...coursePayload(proposed) });
        } catch (error) {
          const detail = error instanceof CourseRouteError ? error.message : "周回コースを作れませんでした";
          write({ type: "error", detail });
        } finally {
          try {
            controller.close();
          } catch {
            // クライアントが先に切断したときは、残りを送らない
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof CourseRouteError) {
      return NextResponse.json({ detail: error.message }, { status: 502 });
    }
    return toErrorResponse(error);
  }
}
