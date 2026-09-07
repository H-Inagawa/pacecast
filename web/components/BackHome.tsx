import Link from "next/link";

type Props = {
  variant?: "link" | "button";
};

export function BackHome({ variant = "link" }: Props) {
  if (variant === "button") {
    return (
      <Link className="button home-back" href="/">
        ホームへ戻る
      </Link>
    );
  }

  return (
    <Link className="back-link" href="/">
      ← ホームへ戻る
    </Link>
  );
}
