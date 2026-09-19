import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadEnv } from "./env";
import { ApiError } from "./errors";
import { cookieSecure, resolveAppOrigin } from "./origin";
import { getServiceClient, requireData } from "./supabase";
import { parseDbTimestamp, toDbTimestamp } from "./datetime";
import type { AuthUserRow, EmailVerificationRow } from "./types";
import { ONBOARDING_COOKIE } from "../onboarding";

export const SESSION_COOKIE = "pacecast_session";
export const SESSION_DAYS = 14;
export const PBKDF2_ITERATIONS = 120_000;
export const TOKEN_HOURS = 24;

export type PublicUser = {
  id: number;
  email: string;
};

function secret(): string {
  loadEnv();
  const value = process.env.PACECAST_SECRET || "pacecast-local-secret";
  if (process.env.VERCEL === "1" && (!process.env.PACECAST_SECRET || value === "pacecast-local-secret")) {
    throw new ApiError(
      503,
      "本番のセッション署名が未設定です。Vercel の Environment Variables に PACECAST_SECRET を入れてください",
    );
  }
  return value;
}

function appOrigin(): string {
  loadEnv();
  return resolveAppOrigin();
}

function devEmail(): string {
  loadEnv();
  return (process.env.PACECAST_DEV_EMAIL || "dev@pacecast.local").trim().toLowerCase();
}

function devPassword(): string {
  loadEnv();
  return process.env.PACECAST_DEV_PASSWORD || "pacecast-dev";
}

export function normalizeEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  if (value.split("@").length !== 2) {
    return false;
  }
  const [local, domain] = value.split("@");
  return Boolean(local) && domain.includes(".") && !value.includes(" ");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), PBKDF2_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4) {
    return false;
  }
  const [scheme, iterations, salt, digest] = parts;
  if (scheme !== "pbkdf2") {
    return false;
  }
  try {
    const expected = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, "hex"),
      Number(iterations),
      32,
      "sha256",
    );
    const actual = Buffer.from(digest, "hex");
    if (expected.length !== actual.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function makeSessionToken(userId: number, now = new Date()): string {
  const expires = Math.trunc(now.getTime() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const payload = `${userId}.${expires}`;
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function readSessionUserId(token: string | null | undefined, now = new Date()): number | null {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [userIdText, expiresText, signature] = parts;
  const payload = `${userIdText}.${expiresText}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }
  const expires = Number(expiresText);
  const userId = Number(userIdText);
  if (!Number.isInteger(userId) || !Number.isFinite(expires)) {
    return null;
  }
  if (expires < Math.trunc(now.getTime() / 1000)) {
    return null;
  }
  return userId;
}

export async function userFromSession(token: string | null | undefined): Promise<AuthUserRow | null> {
  const userId = readSessionUserId(token);
  if (userId == null) {
    return null;
  }
  const client = getServiceClient();
  const result = await client.from("auth_users").select("*").eq("id", userId).maybeSingle();
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  const user = result.data as AuthUserRow | null;
  if (user == null || !user.email_verified) {
    return null;
  }
  return user;
}

export async function requireUser(): Promise<AuthUserRow> {
  const store = await cookies();
  const user = await userFromSession(store.get(SESSION_COOKIE)?.value);
  if (user == null) {
    throw new ApiError(401, "ログインしてください");
  }
  return user;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: cookieSecure(),
  };
}

export function attachSessionCookie(response: NextResponse, userId: number): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: makeSessionToken(userId),
    ...cookieOptions(SESSION_DAYS * 24 * 60 * 60),
  });
  return response;
}

export function attachOnboardingCookie(response: NextResponse, needed: boolean): NextResponse {
  if (needed) {
    response.cookies.set({
      name: ONBOARDING_COOKIE,
      value: "1",
      ...cookieOptions(SESSION_DAYS * 24 * 60 * 60),
    });
  } else {
    response.cookies.set({
      name: ONBOARDING_COOKIE,
      value: "",
      ...cookieOptions(0),
    });
  }
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    ...cookieOptions(0),
  });
  return attachOnboardingCookie(response, false);
}

export async function ensureDevUser(): Promise<AuthUserRow> {
  const client = getServiceClient();
  const email = devEmail();
  const existing = await client.from("auth_users").select("*").eq("email", email).maybeSingle();
  if (existing.error) {
    throw new ApiError(500, existing.error.message);
  }
  if (existing.data) {
    const user = existing.data as AuthUserRow;
    if (!user.email_verified) {
      const updated = await client
        .from("auth_users")
        .update({ email_verified: true })
        .eq("id", user.id)
        .select("*")
        .single();
      return (await requireData(updated)) as AuthUserRow;
    }
    return user;
  }
  const inserted = await client
    .from("auth_users")
    .insert({
      email,
      password_hash: hashPassword(devPassword()),
      email_verified: true,
      created_at: toDbTimestamp(new Date()),
    })
    .select("*")
    .single();
  return (await requireData(inserted)) as AuthUserRow;
}

export async function authenticate(email: string, password: string): Promise<AuthUserRow> {
  const normalized = normalizeEmail(email);
  if (normalized === devEmail() && password === devPassword()) {
    return ensureDevUser();
  }
  const client = getServiceClient();
  const result = await client.from("auth_users").select("*").eq("email", normalized).maybeSingle();
  if (result.error) {
    throw new ApiError(500, result.error.message);
  }
  const user = result.data as AuthUserRow | null;
  if (user == null || !verifyPassword(password, user.password_hash)) {
    throw new ApiError(401, "メールアドレスまたはパスワードが違います");
  }
  if (!user.email_verified) {
    throw new ApiError(403, "メールの確認がまだです。届いたリンクを開いてください");
  }
  return user;
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ user: AuthUserRow; verification: EmailVerificationRow }> {
  const normalized = normalizeEmail(email);
  if (!isPlausibleEmail(normalized)) {
    throw new ApiError(400, "メールアドレスの形式が正しくありません");
  }
  if (normalized === devEmail()) {
    throw new ApiError(400, "このメールアドレスは開発者用です。ログイン画面から入ってください");
  }
  if (password.length < 8) {
    throw new ApiError(400, "パスワードは8文字以上にしてください");
  }

  const client = getServiceClient();
  const existing = await client.from("auth_users").select("*").eq("email", normalized).maybeSingle();
  if (existing.error) {
    throw new ApiError(500, existing.error.message);
  }
  let user = existing.data as AuthUserRow | null;
  if (user != null && user.email_verified) {
    throw new ApiError(400, "このメールアドレスは登録済みです");
  }

  const now = toDbTimestamp(new Date());
  if (user == null) {
    const inserted = await client
      .from("auth_users")
      .insert({
        email: normalized,
        password_hash: hashPassword(password),
        email_verified: false,
        created_at: now,
      })
      .select("*")
      .single();
    user = (await requireData(inserted)) as AuthUserRow;
  } else {
    const updated = await client
      .from("auth_users")
      .update({ password_hash: hashPassword(password) })
      .eq("id", user.id)
      .select("*")
      .single();
    user = (await requireData(updated)) as AuthUserRow;
  }

  const expires = new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000);
  const insertedToken = await client
    .from("email_verifications")
    .insert({
      user_id: user.id,
      token: crypto.randomBytes(32).toString("base64url"),
      expires_at: toDbTimestamp(expires),
      used_at: null,
      created_at: now,
    })
    .select("*")
    .single();
  const verification = (await requireData(insertedToken)) as EmailVerificationRow;
  return { user, verification };
}

export function verificationUrl(token: string): string {
  return `${appOrigin()}/verify?token=${token}`;
}

export async function sendVerificationEmail(toEmail: string, url: string): Promise<boolean> {
  loadEnv();
  const host = process.env.PACECAST_SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.PACECAST_SMTP_PORT || "587");
  const user = (process.env.PACECAST_SMTP_USER || "").trim();
  const password = (process.env.PACECAST_SMTP_PASSWORD || "").replace(/\s+/g, "");
  const from = (process.env.PACECAST_SMTP_FROM || user).trim();
  if (!user || !password) {
    console.info("確認リンク（SMTP 未設定）:", url);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass: password },
  });
  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: "PaceCast のメール確認",
      text:
        "PaceCast の登録を確認してください。\n\n" +
        "次のリンクを開くと、メールアドレスが確認されます。\n\n" +
        `${url}\n\n` +
        "このリンクは 24 時間有効です。覚えのない登録なら、このメールは無視してください。\n",
    });
  } catch (error) {
    console.error(error);
    throw new ApiError(
      502,
      "確認メールを送れませんでした。Gmail のアプリパスワードと .env を確認してください",
    );
  }
  return true;
}

export async function verifyEmailToken(token: string): Promise<AuthUserRow> {
  const client = getServiceClient();
  const found = await client.from("email_verifications").select("*").eq("token", token).maybeSingle();
  if (found.error) {
    throw new ApiError(500, found.error.message);
  }
  const verification = found.data as EmailVerificationRow | null;
  if (verification == null || verification.used_at != null) {
    throw new ApiError(400, "確認リンクが無効です");
  }
  if (parseDbTimestamp(verification.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "確認リンクの期限が切れています。もう一度登録してください");
  }
  const userResult = await client.from("auth_users").select("*").eq("id", verification.user_id).maybeSingle();
  if (userResult.error) {
    throw new ApiError(500, userResult.error.message);
  }
  const user = userResult.data as AuthUserRow | null;
  if (user == null) {
    throw new ApiError(400, "確認リンクが無効です");
  }
  const now = toDbTimestamp(new Date());
  await client.from("email_verifications").update({ used_at: now }).eq("id", verification.id);
  const updated = await client
    .from("auth_users")
    .update({ email_verified: true })
    .eq("id", user.id)
    .select("*")
    .single();
  return (await requireData(updated)) as AuthUserRow;
}
