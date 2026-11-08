"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "../../components/PasswordField";
import { apiGet, apiSend } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";

const INVALID_RESET_PATH = "/forgot-password?invalid=1";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace(INVALID_RESET_PATH);
      return;
    }
    let cancelled = false;
    void apiGet<{ ok: boolean }>(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(INVALID_RESET_PATH);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const user = await apiSend<AuthUser>("/api/auth/reset-password", "POST", { token, password });
      window.location.assign(user.onboarding_complete === false ? "/settings" : "/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "パスワードを変更できませんでした";
      if (message.includes("再設定リンクが無効") || message.includes("期限が切れ")) {
        router.replace(INVALID_RESET_PATH);
        return;
      }
      setError(message);
    }
  }

  if (!ready) {
    return null;
  }

  return (
    <section className="auth-page">
      <h1>新しいパスワード</h1>
      <p className="lede">8文字以上の新しいパスワードを入力してください。</p>
      {error ? <p className="error">{error}</p> : null}
      <form className="stack" onSubmit={onSubmit}>
        <PasswordField
          label="新しいパスワード（8文字以上）"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          minLength={8}
          required
        />
        <button type="submit" className="button primary">
          パスワードを変更する
        </button>
      </form>
      <p>
        リンクが使えないときは <Link href="/forgot-password">再設定をやり直す</Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="auth-page">読み込み中...</section>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
