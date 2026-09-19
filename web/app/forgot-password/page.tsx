"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiSend } from "../../lib/api";
import type { ForgotPasswordResult } from "../../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const payload = await apiSend<ForgotPasswordResult>("/api/auth/forgot-password", "POST", { email });
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再設定を依頼できませんでした");
    }
  }

  return (
    <section className="auth-page">
      <p className="eyebrow">PACECAST</p>
      <h1>パスワード再設定</h1>
      <p className="lede">登録したメールアドレスに、再設定用のリンクを送ります。</p>
      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <div className="notice">
          <p>{result.message}</p>
          {result.reset_url ? (
            <p>
              <a href={result.reset_url}>パスワード再設定のリンクを開く</a>
            </p>
          ) : null}
        </div>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          <label>
            メールアドレス
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="button primary">
            再設定リンクを送る
          </button>
        </form>
      )}
      <p>
        <Link href="/login">ログインへ戻る</Link>
      </p>
    </section>
  );
}
