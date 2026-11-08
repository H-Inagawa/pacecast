"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPageLayout, AuthPageSuspenseFallback } from "../../components/AuthPageLayout";
import { PasswordField } from "../../components/PasswordField";
import { apiGet, apiSend } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";
import { pathAfterAuth } from "../../lib/auth-redirect";
import { errorMessage } from "../../lib/errors";

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
      window.location.assign(pathAfterAuth(user));
    } catch (err) {
      const message = errorMessage(err, "パスワードを変更できませんでした");
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
    <AuthPageLayout
      title="新しいパスワード"
      lede="8文字以上の新しいパスワードを入力してください。"
      error={error}
    >
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
    </AuthPageLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthPageSuspenseFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
