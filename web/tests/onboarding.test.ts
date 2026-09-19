import { describe, expect, it } from "vitest";
import {
  onboardingRedirectPath,
  onboardingStepFromLocation,
  onboardingStepState,
  profileNeedsOnboarding,
  sessionNeedsSettings,
} from "../lib/onboarding";

describe("登録導線", () => {
  it("ログイン中でユーザー名が無いと設定へ戻す", () => {
    expect(sessionNeedsSettings({ email: "runner@example.com", display_name: null })).toBe(true);
    expect(sessionNeedsSettings({ email: "runner@example.com", display_name: "  " })).toBe(true);
    expect(sessionNeedsSettings({ email: "runner@example.com", display_name: "あい" })).toBe(false);
    expect(sessionNeedsSettings({ email: null, display_name: null })).toBe(false);
  });

  it("ユーザー名・誕生日・地点が無いと設定が未完了", () => {
    expect(
      profileNeedsOnboarding({
        display_name: null,
        birthday: null,
        amedas_station_id: "44132",
      }),
    ).toBe(true);
    expect(
      profileNeedsOnboarding({
        display_name: "あい",
        birthday: "1995-09-12",
        amedas_station_id: "44071",
      }),
    ).toBe(false);
  });

  it("画面の場所から今の段階が分かる", () => {
    expect(onboardingStepFromLocation("/register")).toBe("email");
    expect(onboardingStepFromLocation("/register", "sent=1")).toBe("verify");
    expect(onboardingStepFromLocation("/verify")).toBe("verify");
    expect(onboardingStepFromLocation("/settings")).toBe("settings");
    expect(onboardingStepState("email", "verify")).toBe("done");
    expect(onboardingStepState("verify", "verify")).toBe("current");
    expect(onboardingStepState("settings", "verify")).toBe("todo");
  });

  it("設定が未完了ならホームや走行記録へ行かず設定へ戻す", () => {
    expect(onboardingRedirectPath("/", true, true)).toBe("/settings");
    expect(onboardingRedirectPath("/runs", true, true)).toBe("/settings");
    expect(onboardingRedirectPath("/login", true, true)).toBe("/settings");
    expect(onboardingRedirectPath("/settings", true, true)).toBeNull();
    expect(onboardingRedirectPath("/verify", true, true)).toBeNull();
    expect(onboardingRedirectPath("/", true, false)).toBeNull();
    expect(onboardingRedirectPath("/login", true, false)).toBe("/");
  });
});
