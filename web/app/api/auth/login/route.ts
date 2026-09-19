import { NextResponse } from "next/server";
import { authenticate, attachOnboardingCookie, attachSessionCookie } from "../../../../lib/server/auth";
import { toErrorResponse } from "../../../../lib/server/errors";
import { sessionNeedsSettings } from "../../../../lib/onboarding";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await authenticate(body.email ?? "", body.password ?? "");
    const profile = await getOrCreateProfile(user);
    const needsOnboarding = sessionNeedsSettings({
      email: user.email,
      display_name: profile.display_name,
    });
    const response = attachSessionCookie(
      NextResponse.json({ id: user.id, email: user.email, onboarding_complete: !needsOnboarding }),
      user.id,
    );
    return attachOnboardingCookie(response, needsOnboarding);
  } catch (error) {
    return toErrorResponse(error);
  }
}
