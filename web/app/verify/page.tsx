"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";

function VerifyClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("確認リンクが無効です");
      return;
    }
    let cancelled = false;
    apiGet<AuthUser>(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) {
          setDone(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "確認できませんでした");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="auth-page">
      <p className="eyebrow">PACECAST</p>
      <h1>メール確認</h1>
      {error ? (
        <>
          <p className="error">{error}</p>
          <p>
            <Link href="/register">新規登録に戻る</Link>
          </p>
        </>
      ) : done ? (
        <>
          <p className="notice">メールアドレスを確認しました。メイン画面へ進めます。</p>
          <p>
            <Link className="button primary" href="/">
              ホームへ
            </Link>
          </p>
        </>
      ) : (
        <p className="lede">確認しています…</p>
      )}
    </section>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="lede">確認しています…</p>}>
      <VerifyClient />
    </Suspense>
  );
}
