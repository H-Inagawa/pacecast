"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { beginLoading, endLoading, isAppNavigation } from "../lib/loading";

export function NavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingRef = useRef(false);
  const safetyRef = useRef<number | undefined>(undefined);

  function start(): void {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    beginLoading();
    safetyRef.current = window.setTimeout(() => {
      settle();
    }, 8000);
  }

  function settle(): void {
    if (safetyRef.current != null) {
      window.clearTimeout(safetyRef.current);
      safetyRef.current = undefined;
    }
    if (!pendingRef.current) {
      return;
    }
    pendingRef.current = false;
    endLoading();
  }

  useEffect(() => {
    settle();
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !isAppNavigation(anchor, window.location)) {
        return;
      }
      start();
    }

    function onPopState(): void {
      start();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      settle();
    };
  }, []);

  return null;
}
