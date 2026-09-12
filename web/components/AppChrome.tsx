"use client";

import { usePathname } from "next/navigation";

const AUTH_PAGES = new Set(["/login", "/register", "/verify"]);

export function AppChrome({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  if (AUTH_PAGES.has(pathname)) {
    return <>{children}</>;
  }
  return (
    <>
      {header}
      {children}
    </>
  );
}
