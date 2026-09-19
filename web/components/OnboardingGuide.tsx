"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, onboardingStepFromLocation, onboardingStepState } from "../lib/onboarding";

export function OnboardingGuide() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
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
