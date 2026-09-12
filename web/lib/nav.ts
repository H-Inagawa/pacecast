export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム" },
  { href: "/runs", label: "走行記録" },
  { href: "/predict", label: "パフォーマンスを予測" },
  { href: "/analyze", label: "分析結果" },
  { href: "/settings", label: "設定" },
];

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
