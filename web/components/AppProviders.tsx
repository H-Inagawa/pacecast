"use client";

import { Suspense } from "react";
import { LoadingOverlay } from "./LoadingOverlay";
import { NavigationLoading } from "./NavigationLoading";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationLoading />
      </Suspense>
      {children}
      <LoadingOverlay />
    </>
  );
}
