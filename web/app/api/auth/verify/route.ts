import { NextResponse } from "next/server";
import { attachOnboardingCookie, attachSessionCookie, verifyEmailToken } from "../../../../lib/server/auth";
import { toErrorResponse, ApiError } from "../../../../lib/server/errors";
import { sessionNeedsSettings } from "../../../../lib/onboarding";
import { getOrCreateProfile } from "../../../../lib/server/profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) {
      throw new ApiError(400, "確認リンクが無効です");
    }
    const user = await verifyEmailToken(token);
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
