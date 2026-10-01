export const LOADING_SHOW_DELAY_MS = 150;

export type LoadingState = {
  count: number;
  message: string;
  cancel: (() => void) | null;
};

type Listener = (state: LoadingState) => void;

let count = 0;
let message = "";
let cancel: (() => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  const state = { count, message, cancel };
  for (const listener of listeners) {
    listener(state);
  }
}

export function beginLoading(): void {
  count += 1;
  notify();
}

export function endLoading(): void {
  count = Math.max(0, count - 1);
  if (count === 0) {
    message = "";
    cancel = null;
  }
  notify();
}

export function setLoadingMessage(text: string): void {
  message = text;
  notify();
}

export function setLoadingCancel(next: (() => void) | null): void {
  cancel = next;
  notify();
}

export function getLoadingCount(): number {
  return count;
}

export function getLoadingMessage(): string {
  return message;
}

export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  listener({ count, message, cancel });
  return () => {
    listeners.delete(listener);
  };
}

export function resetLoadingForTests(): void {
  count = 0;
  message = "";
  cancel = null;
  notify();
}

export function isAppNavigation(anchor: HTMLAnchorElement, location: Pick<Location, "origin" | "pathname" | "search" | "href">): boolean {
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  let next: URL;
  try {
    next = new URL(href, location.href);
  } catch {
    return false;
  }
  if (next.origin !== location.origin) {
    return false;
  }
  return next.pathname !== location.pathname || next.search !== location.search;
}
