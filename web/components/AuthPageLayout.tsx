import type { ReactNode } from "react";

type Props = {
  title: string;
  lede?: string;
  error?: string;
  children: ReactNode;
};

/**
 * ログイン・登録など認証系画面の共通レイアウト。
 */
export function AuthPageLayout({ title, lede, error, children }: Props) {
  return (
    <section className="auth-page">
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {children}
    </section>
  );
}

export function AuthPageSuspenseFallback({ label = "読み込み中..." }: { label?: string }) {
  return <section className="auth-page">{label}</section>;
}
