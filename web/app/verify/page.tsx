"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPageLayout, AuthPageSuspenseFallback } from "../../components/AuthPageLayout";
import { apiGet } from "../../lib/api";
import type { AuthUser } from "../../lib/auth";
import { errorMessage } from "../../lib/errors";

function VerifyClient() {
  const router = useRouter();
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
      .then((user) => {
        if (!cancelled) {
          setDone(true);
          if (user.onboarding_complete === false) {
            router.replace("/settings");
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err, "確認できませんでした"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <AuthPageLayout title="メール確認" error={error} lede={error || done ? undefined : "確認しています…"}>
      {error ? (
        <p>
          <Link href="/register">新規登録に戻る</Link>
        </p>
      ) : done ? (
        <>
          <p className="notice">メールアドレスを確認しました。ユーザー名・地点・誕生日を入力してください。</p>
          <p>
            <Link className="button primary" href="/settings">
              ユーザー設定へ
            </Link>
          </p>
        </>
      ) : null}
    </AuthPageLayout>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthPageSuspenseFallback label="確認しています…" />}>
      <VerifyClient />
    </Suspense>
  );
}
