import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { attachOnboardingCookie, SESSION_COOKIE, userFromSession } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { sessionNeedsSettings } from "../../../../lib/onboarding";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function GET() {
  try {
    const store = await cookies();
    const user = await userFromSession(store.get(SESSION_COOKIE)?.value);
    if (user == null) {
      return NextResponse.json({ authenticated: false, email: null, display_name: null, needs_settings: false });
    }
    const profile = await getOrCreateProfile(user);
    const needsSettings = sessionNeedsSettings({
      email: user.email,
      display_name: profile.display_name,
    });
    return attachOnboardingCookie(
      NextResponse.json({
        authenticated: true,
        email: user.email,
        display_name: profile.display_name,
        needs_settings: needsSettings,
      }),
      needsSettings,
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
