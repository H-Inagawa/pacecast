import { NextResponse } from "next/server";
import { authenticate, attachSessionCookie } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await authenticate(body.email ?? "", body.password ?? "");
    await getOrCreateProfile(user);
    return attachSessionCookie(NextResponse.json({ id: user.id, email: user.email }), user.id);
  } catch (error) {
    return toErrorResponse(error);
  }
}
