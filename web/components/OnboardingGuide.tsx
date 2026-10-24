"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, onboardingStepFromLocation, onboardingStepState } from "../lib/onboarding";

export function OnboardingGuide() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [settingsFlow, setSettingsFlow] = useState(false);

  useEffect(() => {
    if (pathname !== "/settings") {
      setSettingsFlow(false);
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((me: { needs_settings?: boolean } | null) => {
        if (!cancelled) {
          setSettingsFlow(Boolean(me?.needs_settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsFlow(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const onFlow = pathname === "/register" || pathname === "/verify" || (pathname === "/settings" && settingsFlow);
  if (!onFlow) {
    return null;
  }
  const current = onboardingStepFromLocation(pathname, searchParams.toString());

  return (
    <nav className="onboarding-guide" aria-label="登録の流れ">
      <ol className="onboarding-steps">
        {ONBOARDING_STEPS.map((step, index) => {
          const state = onboardingStepState(step.id, current);
          return (
            <li key={step.id} className={`onboarding-step ${state}`}>
              {index > 0 ? <span className="onboarding-arrow" aria-hidden="true">⇒</span> : null}
              <span aria-current={state === "current" ? "step" : undefined}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
