export const ONBOARDING_STEPS = [
  { id: "email", label: "メールアドレス入力" },
  { id: "verify", label: "メール確認" },
  { id: "settings", label: "ユーザー設定入力" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export function profileNeedsOnboarding(profile: {
  display_name?: string | null;
  birthday?: string | null;
  amedas_station_id?: string | null;
}): boolean {
  return !profile.display_name?.trim() || !profile.birthday || !profile.amedas_station_id;
}

export function sessionNeedsSettings(input: {
  email?: string | null;
  display_name?: string | null;
}): boolean {
  return Boolean(input.email?.trim()) && !input.display_name?.trim();
}

export function onboardingStepFromLocation(pathname: string, search = ""): OnboardingStepId {
  const path = pathname || "/";
  const sent = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).has("sent");
  if (path === "/register") {
    return sent ? "verify" : "email";
  }
  if (path === "/verify") {
    return "verify";
  }
  return "settings";
}

export const ONBOARDING_COOKIE = "pacecast_onboarding";

export function onboardingRedirectPath(
  pathname: string,
  hasSession: boolean,
  needsOnboarding: boolean,
): string | null {
  if (!hasSession) {
    return null;
  }
  if (needsOnboarding) {
    if (
      pathname === "/settings" ||
      pathname === "/verify" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password"
    ) {
      return null;
    }
    return "/settings";
  }
  if (pathname === "/login" || pathname === "/register") {
    return "/";
  }
  return null;
}

export function onboardingStepState(
  stepId: OnboardingStepId,
  current: OnboardingStepId,
): "done" | "current" | "todo" {
  const order = ONBOARDING_STEPS.map((item) => item.id);
  const here = order.indexOf(stepId);
  const now = order.indexOf(current);
  if (here < now) {
    return "done";
  }
  if (here === now) {
    return "current";
  }
  return "todo";
}
