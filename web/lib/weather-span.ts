import { WBGT_METHOD } from "./constants";
import { estimateWbgt } from "./wbgt";
import type { WeatherRow } from "./server/types";

export const SPAN_AVERAGE_MIN_DURATION_SEC = 60 * 60 + 1;

export function runEndedAt(startedAt: Date, durationSec: number): Date {
  return new Date(startedAt.getTime() + Math.max(0, durationSec) * 1000);
}

export function shouldAverageWeatherSpan(durationSec: number): boolean {
  return durationSec >= SPAN_AVERAGE_MIN_DURATION_SEC;
}

export function meanNumbers(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (nums.length === 0) {
    return null;
  }
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function effectiveWeather(start: WeatherRow | null, end: WeatherRow | null): WeatherRow | null {
  if (start == null) {
    return null;
  }
  if (end == null || end.id === start.id) {
    return start;
  }
  const startMs = new Date(start.observed_at).getTime();
  const endMs = new Date(end.observed_at).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && Math.abs(endMs - startMs) <= 60 * 60 * 1000) {
    return start;
  }
  const temperatureC = meanNumbers([start.temperature_c, end.temperature_c]);
  const humidityPct = meanNumbers([start.humidity_pct, end.humidity_pct]);
  if (temperatureC == null || humidityPct == null) {
    return start;
  }
  const windMs = meanNumbers([start.wind_ms, end.wind_ms]);
  const solarWm2 = meanNumbers([start.solar_wm2, end.solar_wm2]);
  let wbgtC = meanNumbers([start.wbgt_c, end.wbgt_c]);
  let method = start.wbgt_method;
  if (windMs != null && solarWm2 != null) {
    wbgtC = estimateWbgt(temperatureC, humidityPct, solarWm2, windMs);
    method = WBGT_METHOD;
  }
  return {
    ...start,
    temperature_c: temperatureC,
    humidity_pct: humidityPct,
    wind_ms: windMs,
    solar_wm2: solarWm2,
    wbgt_c: wbgtC,
    wbgt_method: method,
  };
}
