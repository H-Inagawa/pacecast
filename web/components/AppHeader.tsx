import { Suspense } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { DrawerMenu } from "./DrawerMenu";
import { OnboardingGuide } from "./OnboardingGuide";
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
      <header className="site-header">
        {signedIn ? <DrawerMenu lockNav={onboarding} /> : <span className="header-icon-slot" aria-hidden="true" />}
        <div className="header-identity">
          {signedIn && !onboarding ? (
            <Link className="brand" href={homeHref}>
              PaceCast
            </Link>
          ) : (
            <span className="brand">PaceCast</span>
          )}
          {displayName ? <p className="header-user">{`${displayName} さん`}</p> : null}
        </div>
        {signedIn && !onboarding ? (
          <Link className="settings-icon" href="/settings" aria-label="設定" title="設定">
            <span className="settings-icon-glyph">
              <img src="/icons/gear.svg" alt="" width={30} height={30} />
            </span>
          </Link>
        ) : (
          <span className="header-icon-slot" aria-hidden="true" />
        )}
      </header>
      {showGuide ? (
        <Suspense fallback={null}>
          <OnboardingGuide />
        </Suspense>
      ) : null}
    </div>
  );
}
