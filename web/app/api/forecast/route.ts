import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { ApiError, toErrorResponse } from "../../../lib/server/errors";
import { buildRunningForecast } from "../../../lib/server/running-forecast";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    await requireUser();
    const stationId = new URL(request.url).searchParams.get("station_id");
    if (!stationId) {
      throw new ApiError(400, "アメダス地点を指定してください");
    }
    return NextResponse.json(await buildRunningForecast(stationId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
