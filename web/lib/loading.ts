export const LOADING_SHOW_DELAY_MS = 150;

type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(count);
  }
}

export function beginLoading(): void {
  count += 1;
  notify();
}

export function endLoading(): void {
  count = Math.max(0, count - 1);
  notify();
}

export function getLoadingCount(): number {
  return count;
}

export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  listener(count);
  return () => {
    listeners.delete(listener);
  };
}

export function resetLoadingForTests(): void {
  count = 0;
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
