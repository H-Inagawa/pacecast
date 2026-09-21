import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { OnboardingGuide } from "./OnboardingGuide";
import { SiteHeader } from "./SiteHeader";
import { SESSION_COOKIE, userFromSession } from "../lib/server/auth";
import { getOrCreateProfile } from "../lib/server/profile";
import { profileNeedsOnboarding } from "../lib/onboarding";

export async function AppHeader() {
  const pathname = (await headers()).get("x-pathname") || "";
  let displayName: string | null = null;
  let signedIn = false;
  let onboarding = false;
  try {
    const store = await cookies();
    const user = await userFromSession(store.get(SESSION_COOKIE)?.value);
    if (user) {
      signedIn = true;
      const profile = await getOrCreateProfile(user);
      displayName = profile.display_name;
      onboarding = profileNeedsOnboarding(profile);
    }
  } catch {
    displayName = null;
  }

  const showGuide = onboarding || pathname === "/register" || pathname === "/verify";
  const homeHref = onboarding ? "/settings" : "/";

  return (
    <div className="site-header-wrap">
      <SiteHeader signedIn={signedIn} onboarding={onboarding} displayName={displayName} homeHref={homeHref} />
      {showGuide ? (
        <Suspense fallback={null}>
          <OnboardingGuide />
        </Suspense>
      ) : null}
    </div>
  );
}
