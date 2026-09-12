"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiSend } from "../lib/api";
import { NAV_ITEMS, isCurrentPath } from "../lib/nav";

export function DrawerMenu() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function onLogout() {
    try {
      await apiSend("/api/auth/logout", "POST");
    } catch {
      // Cookie が残っていてもログイン画面へ戻す
    }
    window.location.assign("/login");
  }

  return (
    <>
      <button
        type="button"
        className="drawer-toggle"
        aria-label="メニュー"
        aria-expanded={open}
        aria-controls="site-drawer"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" />
        </svg>
      </button>
      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)} role="presentation">
          <nav
            id="site-drawer"
            className="drawer-panel"
            aria-label="サイト内メニュー"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="drawer-title">メニュー</p>
            <ul className="drawer-list">
              {NAV_ITEMS.map((item) => {
                const current = isCurrentPath(pathname, item.href);
                return (
                  <li key={item.href}>
                    {current ? (
                      <span className="drawer-item current" aria-current="page">
                        {item.label}
                      </span>
                    ) : (
                      <Link className="drawer-item" href={item.href}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="drawer-item drawer-logout" onClick={onLogout}>
              ログアウト
            </button>
          </nav>
        </div>
      ) : null}
    </>
  );
}
