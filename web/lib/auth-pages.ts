export const AUTH_PAGES = ["/login", "/register", "/verify", "/forgot-password", "/reset-password"] as const;

/** オンボーディング未完了でも開けるパス（認証系 + 設定）。 */
export const ONBOARDING_OPEN_PATHS = new Set<string>([...AUTH_PAGES, "/settings"]);
