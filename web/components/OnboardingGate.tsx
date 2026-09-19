import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_PAGES } from "../lib/auth-pages";
import { sessionNeedsSettings } from "../lib/onboarding";
import { SESSION_COOKIE, userFromSession } from "../lib/server/auth";
import { getOrCreateProfile } from "../lib/server/profile";

const OPEN_PATHS = new Set<string>([...AUTH_PAGES, "/settings"]);

export async function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") || "/";
  if (OPEN_PATHS.has(pathname)) {
    return children;
  }

  try {
    const store = await cookies();
    const user = await userFromSession(store.get(SESSION_COOKIE)?.value);
    if (!user) {
      return children;
    }
    const profile = await getOrCreateProfile(user);
    if (sessionNeedsSettings({ email: user.email, display_name: profile.display_name })) {
      redirect("/settings");
    }
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    const store = await cookies();
    if (store.get(SESSION_COOKIE)?.value) {
      redirect("/settings");
    }
  }

  return children;
}
