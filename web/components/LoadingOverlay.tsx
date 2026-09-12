"use client";

import { useEffect, useState } from "react";
import { LOADING_SHOW_DELAY_MS, subscribeLoading } from "../lib/loading";

export function LoadingOverlay() {
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeLoading((count) => setBusy(count > 0)), []);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), LOADING_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  if (!visible) {
    return null;
  }

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-spinner" aria-hidden="true" />
      <span className="visually-hidden">処理中</span>
    </div>
  );
}
