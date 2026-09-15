import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, userFromSession } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const store = await cookies();
    const user = await userFromSession(store.get(SESSION_COOKIE)?.value);
    if (user == null) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({ authenticated: true, email: user.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
