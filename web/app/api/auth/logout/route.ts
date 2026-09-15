import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    return clearSessionCookie(NextResponse.json({ message: "ログアウトしました" }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
