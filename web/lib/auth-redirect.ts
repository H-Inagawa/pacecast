import type { AuthUser } from "./auth";

/**
 * ログイン後の遷移先。設定未完了なら設定画面へ戻す。
 */
export function pathAfterAuth(user: Pick<AuthUser, "onboarding_complete">): string {
  return user.onboarding_complete === false ? "/settings" : "/";
}
