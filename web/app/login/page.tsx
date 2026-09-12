"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiSend } from "../../lib/api";
import { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD, type AuthUser } from "../../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiSend<AuthUser>("/api/auth/login", "POST", { email, password });
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインできませんでした");
    }
  }

  return (
    <section className="auth-page">
      <p className="eyebrow">PACECAST</p>
      <h1>ログイン</h1>
      <p className="lede">メールアドレスとパスワードで入ります。</p>
      {error ? <p className="error">{error}</p> : null}
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
          パスワード
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="button primary">
          ログイン
        </button>
      </form>
      <p>
        初めての方は <Link href="/register">新規登録</Link>
      </p>
      <p className="meta">
        開発者は登録なしで <code>{DEV_LOGIN_EMAIL}</code> / <code>{DEV_LOGIN_PASSWORD}</code>{" "}
        から入れます。
      </p>
    </section>
  );
}
