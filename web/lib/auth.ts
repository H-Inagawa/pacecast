export const DEV_LOGIN_EMAIL = "dev@pacecast.local";
export const DEV_LOGIN_PASSWORD = "pacecast-dev";

export type AuthUser = {
  id: number;
  email: string;
};

export type RegisterResult = {
  message: string;
  verification_url?: string | null;
};
