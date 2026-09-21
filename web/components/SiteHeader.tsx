"use client";

import Link from "next/link";
import { DrawerMenu } from "./DrawerMenu";

type Props = {
  signedIn: boolean;
  onboarding: boolean;
  displayName: string | null;
  homeHref: string;
};

export function SiteHeader({ signedIn, onboarding, displayName, homeHref }: Props) {
  return (
    <header className="site-header">
      {signedIn ? (
        <DrawerMenu lockNav={onboarding} />
      ) : (
        <span className="header-icon-slot" aria-hidden="true" />
      )}
      <div className="header-identity">
        {signedIn && !onboarding ? (
          <Link className="brand" href={homeHref}>
            PaceCast
          </Link>
        ) : (
          <span className="brand">PaceCast</span>
        )}
        {displayName ? <p className="header-user">{`${displayName} さん`}</p> : null}
      </div>
      {signedIn && !onboarding ? (
        <Link className="settings-icon" href="/settings" aria-label="設定" title="設定">
          <span className="settings-icon-glyph">
            <img src="/icons/gear.svg" alt="" width={30} height={30} />
          </span>
        </Link>
      ) : (
        <span className="header-icon-slot" aria-hidden="true" />
      )}
    </header>
  );
}
