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
        <div className="header-start">
          {signedIn ? <DrawerMenu lockNav={onboarding} /> : null}
          {signedIn && !onboarding ? (
            <Link className="brand" href={homeHref}>
              PaceCast
            </Link>
          ) : (
            <span className="brand">PaceCast</span>
          )}
        </div>
        <p className="header-user">{displayName ? `${displayName} さん` : ""}</p>
        {signedIn && !onboarding ? (
          <Link className="settings-icon" href="/settings" aria-label="設定" title="設定">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.22-1.14.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.81 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.93 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.49.4 1.04.72 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.22 1.14-.54 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </Link>
        ) : (
          <span />
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
