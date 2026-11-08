"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthPageLayout, AuthPageSuspenseFallback } from "../../components/AuthPageLayout";
import { apiSend } from "../../lib/api";
import { PASSWORD_RESET_INVALID_MESSAGE, type ForgotPasswordResult } from "../../lib/auth";
import { errorMessage } from "../../lib/errors";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkInvalid = searchParams.get("invalid") === "1";
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
      setError(errorMessage(err, "再設定を依頼できませんでした"));
    }
  }

  return (
    <AuthPageLayout
      title="パスワード再設定"
      lede="登録したメールアドレスに、再設定用のリンクを送ります。"
      error={error || (!result && linkInvalid ? PASSWORD_RESET_INVALID_MESSAGE : "")}
    >
      {result ? (
        <div className="notice">
          <p>{result.message}</p>
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
    </AuthPageLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthPageSuspenseFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
