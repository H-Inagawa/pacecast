export const DEV_LOGIN_EMAIL = "dev@pacecast.local";
export const DEV_LOGIN_PASSWORD = "pacecast-dev";

export type AuthUser = {
  id: number;
  email: string;
  onboarding_complete?: boolean;
};

export type RegisterResult = {
  message: string;
  verification_url?: string | null;
};

export const PASSWORD_RESET_SENT_MESSAGE = "入力したメールアドレスに再設定用のリンクを送りました。";

export const PASSWORD_RESET_INVALID_MESSAGE =
  "再設定リンクが無効です。もう一度再設定リンクの送信を試してください。";

export type ForgotPasswordResult = {
  message: string;
};
