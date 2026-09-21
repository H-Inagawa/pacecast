import { describe, expect, it } from "vitest";
import {
  formatForecastAxisLabel,
  formatForecastColumnHeader,
  forecastScrollStartIndex,
  pickCurrentForecastHour,
} from "../lib/runningForecast";

describe("runningForecast helpers", () => {
  it("横軸ラベルは月日と時に分ける", () => {
    expect(formatForecastAxisLabel("2026-09-21 03:00")).toEqual({
      dateLabel: "9/21",
      hourLabel: "3時",
    });
    expect(formatForecastColumnHeader("2026-09-21 15:00")).toBe("9/21 15時");
  });

  it("いまにいちばん近いスロットを選ぶ", () => {
    const hours = [{ observed_at: "2026-09-21 00:00" }, { observed_at: "2026-09-21 03:00" }];
    const now = new Date("2026-09-21T02:40:00+09:00").getTime();
    expect(pickCurrentForecastHour(hours, now)?.observed_at).toBe("2026-09-21 03:00");
  });

  it("横スクロール開始はいま以降の最初のスロット", () => {
    const hours = [
      { observed_at: "2026-09-21 00:00" },
      { observed_at: "2026-09-21 03:00" },
      { observed_at: "2026-09-21 06:00" },
    ];
    const now = new Date("2026-09-21T04:10:00+09:00").getTime();
    expect(forecastScrollStartIndex(hours, now)).toBe(2);
  });
});
