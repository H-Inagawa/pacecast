export type OriginEnv = {
  PACECAST_APP_ORIGIN?: string;
  VERCEL_URL?: string;
  VERCEL?: string;
  NODE_ENV?: string;
};

export function resolveAppOrigin(env: OriginEnv = process.env): string {
  const explicit = (env.PACECAST_APP_ORIGIN || "").trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  const vercel = (env.VERCEL_URL || "").trim().replace(/^https?:\/\//, "");
  if (vercel) {
    return `https://${vercel}`;
  }
  return "http://127.0.0.1:3000";
}

export function cookieSecure(env: OriginEnv = process.env): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}
