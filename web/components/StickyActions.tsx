type Props = {
  children: React.ReactNode;
};

export function StickyActions({ children }: Props) {
  return <nav className="sticky-actions">{children}</nav>;
}
