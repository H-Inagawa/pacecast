import Link from "next/link";
import { apiGet } from "../lib/api";
import type { Profile } from "../lib/types";

export async function AppHeader() {
  let displayName: string | null = null;
  try {
    const profile = await apiGet<Profile>("/api/profile");
    displayName = profile.display_name;
  } catch {
    displayName = null;
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        PaceCast
      </Link>
      <p className="header-user">{displayName ? `${displayName} さん` : ""}</p>
      <Link className="settings-icon" href="/settings" aria-label="設定" title="設定">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.22-1.14.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.81 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.93 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.49.4 1.04.72 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.22 1.14-.54 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      </Link>
    </header>
  );
}
