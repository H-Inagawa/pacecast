type Props = {
  children: React.ReactNode;
  layout?: "main-home" | "settings-main-home";
};

export function StickyActions({ children, layout = "main-home" }: Props) {
  const layoutClass = layout === "settings-main-home" ? " sticky-actions-1-3-1" : "";
  return <nav className={`sticky-actions${layoutClass}`}>{children}</nav>;
}
