import { afterEach, describe, expect, it } from "vitest";
import { beginLoading, endLoading, getLoadingCount, isAppNavigation, resetLoadingForTests } from "../lib/loading";

function anchor(attrs: Record<string, string>): HTMLAnchorElement {
  const el = document.createElement("a");
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

const location = {
  origin: "http://127.0.0.1:3000",
  pathname: "/",
  search: "",
  href: "http://127.0.0.1:3000/",
};

describe("loading store", () => {
  afterEach(() => {
    resetLoadingForTests();
  });

  it("開始と終了で件数を増減する", () => {
    beginLoading();
    beginLoading();
    expect(getLoadingCount()).toBe(2);
    endLoading();
    expect(getLoadingCount()).toBe(1);
    endLoading();
    expect(getLoadingCount()).toBe(0);
  });
});

describe("isAppNavigation", () => {
  it("サイト内の別画面だけを待つ", () => {
    expect(isAppNavigation(anchor({ href: "/runs" }), location)).toBe(true);
    expect(isAppNavigation(anchor({ href: "/" }), location)).toBe(false);
    expect(isAppNavigation(anchor({ href: "https://example.com/" }), location)).toBe(false);
    expect(isAppNavigation(anchor({ href: "/runs", target: "_blank" }), location)).toBe(false);
    expect(isAppNavigation(anchor({ href: "/runs", download: "" }), location)).toBe(false);
  });
});
