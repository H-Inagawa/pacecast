import { describe, expect, it } from "vitest";
import { formatRunnability, runnabilityMark, runnabilityScore } from "../lib/runnability";

describe("走りやすさ", () => {
  it("WBGT 28℃・晴れは 60点で真顔", () => {
    expect(runnabilityScore(28, "晴れ")).toBe(60);
    expect(formatRunnability(28, "晴れ")).toBe("😐 60");
  });

  it("顔は90・80・60・30で切り替える", () => {
    expect(runnabilityMark(90)).toBe("😄");
    expect(runnabilityMark(89)).toBe("🙂");
    expect(runnabilityMark(80)).toBe("🙂");
    expect(runnabilityMark(79)).toBe("😐");
    expect(runnabilityMark(60)).toBe("😐");
    expect(runnabilityMark(59)).toBe("😣");
    expect(runnabilityMark(30)).toBe("😣");
    expect(runnabilityMark(29)).toBe("😫");
  });

  it("適温と雨で減点し、0未満にはしない", () => {
    expect(runnabilityScore(12, "快晴")).toBe(100);
    expect(runnabilityScore(18.2, "快晴")).toBe(94);
    expect(runnabilityScore(22.4, "雨")).toBe(42);
    expect(runnabilityScore(40, "雷雨")).toBe(0);
  });
});
