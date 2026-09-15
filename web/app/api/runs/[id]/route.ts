import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/server/auth";
import { ApiError, toErrorResponse } from "../../../../lib/server/errors";
import { deleteRun, getOwnRun, serializeRun, updateRun, type RunWrite } from "../../../../lib/server/runs";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseRunId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(404, "記録が見つかりません");
  }
  return id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const runId = parseRunId((await context.params).id);
    const record = await getOwnRun(user, runId);
    const profile = await getOrCreateProfile(user);
    return NextResponse.json(serializeRun(record, profile));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const runId = parseRunId((await context.params).id);
    const payload = (await request.json()) as RunWrite;
    return NextResponse.json(await updateRun(user, runId, payload));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const runId = parseRunId((await context.params).id);
    await deleteRun(user, runId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
