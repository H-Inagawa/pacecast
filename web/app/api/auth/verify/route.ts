import { NextResponse } from "next/server";
import { attachSessionCookie, verifyEmailToken } from "../../../../lib/server/auth";
import { toErrorResponse, ApiError } from "../../../../lib/server/errors";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      throw new ApiError(400, "確認リンクが無効です");
    }
    const user = await verifyEmailToken(token);
    await getOrCreateProfile(user);
    return attachSessionCookie(NextResponse.json({ id: user.id, email: user.email }), user.id);
  } catch (error) {
    return toErrorResponse(error);
  }
}
