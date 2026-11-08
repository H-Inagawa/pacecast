import Link from "next/link";

/** 下部バー用の「ホームへ戻る」ボタン。 */
export function BackHome() {
  return (
    <Link className="button home-back" href="/">
      ホームへ戻る
    </Link>
  );
}
