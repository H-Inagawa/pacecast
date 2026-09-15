import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";
import { ApiError } from "./errors";

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  loadEnv();
  if (cached) {
    return cached;
  }
  const url = (process.env.SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new ApiError(
      503,
      "Supabase の接続設定がありません。web/.env.local に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を入れてください",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function requireData<T>(
  result: { data: T | null; error: { message: string } | null },
  fallback = "データベースの操作に失敗しました",
): Promise<T> {
  if (result.error) {
    throw new ApiError(500, result.error.message || fallback);
  }
  if (result.data == null) {
    throw new ApiError(500, fallback);
  }
  return result.data;
}
