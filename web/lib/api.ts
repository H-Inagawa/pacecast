import { AUTH_PAGES } from "./auth-pages";
import { readCourseSearchEvents } from "./course-search";
import { courseSearchLabel } from "./courses";
import { beginLoading, endLoading, setLoadingCancel, setLoadingMessage } from "./loading";
import { loadingMessageFor } from "./loading-messages";

function apiUrl(path: string): string {
  if (typeof window === "undefined") {
    const origin = (process.env.PACECAST_APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
    return `${origin}${path}`;
  }
  return path;
}

const PUBLIC_AUTH_PAGES = new Set<string>(AUTH_PAGES);

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (PUBLIC_AUTH_PAGES.has(window.location.pathname)) {
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

async function withLoading<T>(path: string, method: string, task: () => Promise<T>): Promise<T> {
  const track = typeof window !== "undefined";
  if (track) {
    beginLoading();
    const message = loadingMessageFor(path, method);
    if (message) {
      setLoadingMessage(message);
    }
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
  return withLoading(path, "GET", async () => {
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
  return withLoading(path, method, async () => {
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

export async function apiPostCourses<T>(path: string, body: unknown): Promise<T> {
  return withLoading(path, "POST", async () => {
    const controller = new AbortController();
    setLoadingMessage(courseSearchLabel("map"));
    setLoadingCancel(() => controller.abort());
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((await sessionHeaders()) as Record<string, string>),
      };
      const response = await fetch(apiUrl(path), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 401) {
        redirectToLogin();
      }
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      if (response.body == null) {
        throw new Error("周回コースを作れませんでした");
      }
      return await readCourseSearchEvents<T>(response.body, (_percent, _passed, stage) => {
        setLoadingMessage(courseSearchLabel(stage));
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("検索を中止しました");
      }
      throw error;
    } finally {
      setLoadingCancel(null);
    }
  });
}
