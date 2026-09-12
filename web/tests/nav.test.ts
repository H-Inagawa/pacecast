import { describe, expect, it } from "vitest";
import { isCurrentPath } from "../lib/nav";

describe("isCurrentPath", () => {
  it("ホームは完全一致だけを現在地にする", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/runs", "/")).toBe(false);
  });

  it("走行記録は配下の編集画面も含める", () => {
    expect(isCurrentPath("/runs", "/runs")).toBe(true);
    expect(isCurrentPath("/runs/3/edit", "/runs")).toBe(true);
    expect(isCurrentPath("/predict", "/runs")).toBe(false);
  });
});
