"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiSend } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "再設定リンクが無効です");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("再設定リンクが無効です");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    try {
      const user = await apiSend<AuthUser>("/api/auth/reset-password", "POST", { token, password });
      window.location.assign(user.onboarding_complete === false ? "/settings" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "パスワードを変更できませんでした");
    }
  }

  return (
    <section className="auth-page">
      <p className="eyebrow">PACECAST</p>
      <h1>新しいパスワード</h1>
      <p className="lede">8文字以上の新しいパスワードを入力してください。</p>
      {error ? <p className="error">{error}</p> : null}
      <form className="stack" onSubmit={onSubmit}>
        <label>
          新しいパスワード（8文字以上）
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <label>
          新しいパスワード（確認）
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" className="button primary" disabled={!token}>
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
