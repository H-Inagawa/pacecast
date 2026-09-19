import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_PAGES } from "./lib/auth-pages";
import { ONBOARDING_COOKIE, onboardingRedirectPath } from "./lib/onboarding";

const PUBLIC_AUTH_PAGES = new Set<string>(AUTH_PAGES);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("pacecast_session")?.value;
  const needsOnboarding = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";
  const isAuthPage = PUBLIC_AUTH_PAGES.has(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (!session && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nextPath = onboardingRedirectPath(pathname, Boolean(session), needsOnboarding);
  if (nextPath && nextPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = nextPath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
