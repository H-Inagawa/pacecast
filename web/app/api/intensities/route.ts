import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/server/auth";
import { toErrorResponse } from "../../../lib/server/errors";
import { getOrCreateProfile, serializeProfile } from "../../../lib/server/profile";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await serializeProfile(await getOrCreateProfile(user)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
