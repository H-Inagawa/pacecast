"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthPageLayout } from "../../components/AuthPageLayout";
import { PasswordField } from "../../components/PasswordField";
import { apiSend } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";
import { pathAfterAuth } from "../../lib/auth-redirect";
import { errorMessage } from "../../lib/errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const user = await apiSend<AuthUser>("/api/auth/login", "POST", { email, password });
      window.location.assign(pathAfterAuth(user));
    } catch (err) {
      setError(errorMessage(err, "ログインできませんでした"));
    }
  }

  return (
    <AuthPageLayout title="ログイン" error={error}>
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
        <PasswordField
          label="パスワード"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
        <button type="submit" className="button primary">
          ログイン
        </button>
      </form>
      <p>
        初めての方は <Link href="/register">新規登録</Link>
      </p>
      <p>
        パスワードを忘れた方は <Link href="/forgot-password">再設定</Link>
      </p>
    </AuthPageLayout>
  );
}
