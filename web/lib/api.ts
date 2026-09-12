import { beginLoading, endLoading } from "./loading";

function apiUrl(path: string): string {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:8000${path}`;
  }
  return path;
}

const AUTH_PAGES = new Set(["/login", "/register", "/verify"]);

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (AUTH_PAGES.has(window.location.pathname)) {
    return;
  }
  window.location.assign("/login");
}

async function sessionHeaders(): Promise<HeadersInit> {
  if (typeof window !== "undefined") {
    return {};
  }
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const session = store.get("pacecast_session");
    if (session?.value) {
      return { Cookie: `pacecast_session=${session.value}` };
    }
  } catch {
    return {};
  }
  return {};
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") {
      return payload.detail;
    }
    if (Array.isArray(payload?.detail)) {
      return payload.detail.map((item: { msg?: string }) => item.msg).join(" / ");
    }
  } catch {
    return "リクエストに失敗しました";
  }
  return "リクエストに失敗しました";
}

async function withLoading<T>(task: () => Promise<T>): Promise<T> {
  const track = typeof window !== "undefined";
  if (track) {
    beginLoading();
  }
  try {
    return await task();
  } finally {
    if (track) {
      endLoading();
    }
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return withLoading(async () => {
    const response = await fetch(apiUrl(path), {
      cache: "no-store",
      credentials: "include",
      headers: await sessionHeaders(),
    });
    if (response.status === 401) {
      redirectToLogin();
    }
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    return response.json() as Promise<T>;
  });
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return withLoading(async () => {
    const headers: Record<string, string> = {
      ...((await sessionHeaders()) as Record<string, string>),
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(apiUrl(path), {
      method,
      credentials: "include",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      redirectToLogin();
    }
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    return response.json() as Promise<T>;
  });
}
