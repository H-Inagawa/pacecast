import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { toErrorResponse } from "../../../lib/server/errors";
import { createRun, listRuns, type RunWrite } from "../../../lib/server/runs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await listRuns(user));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as RunWrite;
    return NextResponse.json(await createRun(user, payload));
  } catch (error) {
    return toErrorResponse(error);
  }
}
