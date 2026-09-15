import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { listStations } from "../../../../lib/server/amedas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireUser();
    const stations = await listStations();
    return NextResponse.json(
      stations.map((item) => ({
        station_id: item.stationId,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
      })),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
