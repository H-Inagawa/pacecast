import { describe, expect, it } from "vitest";
import { formatDateTimeLocalValue, formatDateTimeSpace, parseDateTimeLocal, toDbTimestamp } from "../lib/server/datetime";
import { durationFromHms, splitDuration } from "../lib/server/duration";
import { findNearestWeatherRow } from "../lib/server/matching";
import { cookieSecure, resolveAppOrigin } from "../lib/server/origin";
import type { WeatherRow } from "../lib/server/types";

function weather(partial: Partial<WeatherRow> & Pick<WeatherRow, "id" | "observed_at">): WeatherRow {
  return {
    location: "東京",
    temperature_c: 20,
    humidity_pct: 50,
    temperature_quality: null,
    humidity_quality: null,
    wind_ms: 2,
    solar_wm2: 400,
    wbgt_c: 18,
    wbgt_method: "ono2014",
    station_id: "44132",
    source: "open-meteo",
    imported_at: partial.observed_at,
    ...partial,
  };
}

describe("datetime", () => {
  it("datetime-local を東京として解釈する", () => {
    const value = parseDateTimeLocal("2026-09-15T07:00");
    expect(toDbTimestamp(value)).toBe("2026-09-15T07:00:00+09:00");
    expect(formatDateTimeLocalValue(value)).toBe("2026-09-15T07:00");
    expect(formatDateTimeSpace(value)).toBe("2026-09-15 07:00");
  });
});

describe("duration", () => {
  it("時分秒を秒に直し、分解できる", () => {
    expect(durationFromHms(0, 25, 30)).toBe(1530);
    expect(splitDuration(3661)).toEqual([1, 1, 1]);
  });
});

describe("matching", () => {
  it("開始時刻に近く、同時差なら早い観測を選ぶ", () => {
    const started = parseDateTimeLocal("2026-09-15T07:20");
    const rows = [
      weather({ id: 1, observed_at: "2026-09-15T07:00:00+09:00" }),
      weather({ id: 2, observed_at: "2026-09-15T08:00:00+09:00" }),
      weather({ id: 3, observed_at: "2026-09-15T06:00:00+09:00" }),
    ];
    const picked = findNearestWeatherRow(rows, started, "44132");
    expect(picked?.id).toBe(1);
  });

  it("練馬は地点空の旧行も含める", () => {
    const started = parseDateTimeLocal("2026-09-15T07:00");
    const rows = [
      weather({ id: 1, observed_at: "2026-09-15T07:00:00+09:00", station_id: null }),
    ];
    expect(findNearestWeatherRow(rows, started, "44071")?.id).toBe(1);
    expect(findNearestWeatherRow(rows, started, "44132")).toBeNull();
  });
});

describe("origin", () => {
  it("明示した origin を優先する", () => {
    expect(
      resolveAppOrigin({
        PACECAST_APP_ORIGIN: "https://pacecast.vercel.app/",
        VERCEL_URL: "ignored.vercel.app",
      }),
    ).toBe("https://pacecast.vercel.app");
  });

  it("未設定なら Vercel の URL を https で使う", () => {
    expect(resolveAppOrigin({ VERCEL_URL: "pacecast-abc.vercel.app" })).toBe(
      "https://pacecast-abc.vercel.app",
    );
  });

  it("本番では Cookie を secure にする", () => {
    expect(cookieSecure({ VERCEL: "1" })).toBe(true);
    expect(cookieSecure({ NODE_ENV: "production" })).toBe(true);
    expect(cookieSecure({})).toBe(false);
  });
});
