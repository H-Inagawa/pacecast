"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthPageLayout } from "../../components/AuthPageLayout";
import { PasswordField } from "../../components/PasswordField";
import { apiSend } from "../../lib/api";
import type { RegisterResult } from "../../lib/auth";
import { errorMessage } from "../../lib/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const payload = await apiSend<RegisterResult>("/api/auth/register", "POST", {
        email,
        password,
      });
      setResult(payload);
      router.replace("/register?sent=1");
    } catch (err) {
      setError(errorMessage(err, "登録できませんでした"));
    }
  }

  return (
    <AuthPageLayout
      title="新規登録"
      lede="入力したメールアドレスに確認用のリンクを送ります。"
      error={error}
    >
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
          <PasswordField
            label="パスワード（8文字以上）"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            minLength={8}
            required
          />
          <button type="submit" className="button primary">
            登録する
          </button>
        </form>
      )}
      <p>
        すでにアカウントがある方は <Link href="/login">ログイン</Link>
      </p>
    </AuthPageLayout>
  );
}
