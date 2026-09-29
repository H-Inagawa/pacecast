import { describe, expect, it } from "vitest";
import { paddedRange } from "../lib/analyze";

describe("グラフの軸余白", () => {
  it("値が無いときは既定の幅を返す", () => {
    expect(paddedRange([])).toEqual([0, 2]);
  });

  it("値が1点のときは範囲を広げる", () => {
    expect(paddedRange([20], 4)).toEqual([18, 22]);
  });
});
