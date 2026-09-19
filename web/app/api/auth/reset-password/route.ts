import { NextResponse } from "next/server";
import { sessionNeedsSettings } from "../../../../lib/onboarding";
import { attachOnboardingCookie, attachSessionCookie, consumePasswordResetToken } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    const user = await consumePasswordResetToken(body.token ?? "", body.password ?? "");
    const profile = await getOrCreateProfile(user);
    const needsOnboarding = sessionNeedsSettings({
      email: user.email,
      display_name: profile.display_name,
    });
    return attachOnboardingCookie(
      attachSessionCookie(
        NextResponse.json({ id: user.id, email: user.email, onboarding_complete: !needsOnboarding }),
        user.id,
      ),
      needsOnboarding,
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
