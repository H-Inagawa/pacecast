"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiSend } from "../../lib/api";
import type { RegisterResult } from "../../lib/auth";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    try {
      const payload = await apiSend<RegisterResult>("/api/auth/register", "POST", {
        email,
        password,
      });
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録できませんでした");
    }
  }

  return (
    <section className="auth-page">
      <p className="eyebrow">PACECAST</p>
      <h1>新規登録</h1>
      <p className="lede">入力したメールアドレスに確認用のリンクを送ります。</p>
      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <div className="notice">
          <p>{result.message}</p>
          {result.verification_url ? (
            <p>
              <a href={result.verification_url}>メール確認のリンクを開く</a>
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
          <label>
            パスワード（8文字以上）
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
            パスワード（確認）
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
          <button type="submit" className="button primary">
            登録する
          </button>
        </form>
      )}
      <p>
        すでにアカウントがある方は <Link href="/login">ログイン</Link>
      </p>
    </section>
  );
}
