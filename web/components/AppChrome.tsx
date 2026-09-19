"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEADERLESS = new Set(["/login"]);
const OPEN_PATHS = new Set(["/login", "/register", "/verify", "/settings"]);

type MeResponse = {
  authenticated?: boolean;
  email?: string | null;
  display_name?: string | null;
  needs_settings?: boolean;
};

export function AppChrome({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (OPEN_PATHS.has(pathname)) {
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((me: MeResponse | null) => {
        if (cancelled || !me?.authenticated || !me.email) {
          return;
        }
        if (me.needs_settings || !String(me.display_name ?? "").trim()) {
          window.location.replace("/settings");
        }
      })
      .catch(() => {
        // 未ログインは middleware が処理する
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (HEADERLESS.has(pathname)) {
    return <>{children}</>;
  }
  return (
    <>
      {header}
      {children}
    </>
  );
}
