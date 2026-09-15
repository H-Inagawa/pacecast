import {
  DEFAULT_SOLAR_WM2_DAY,
  DEFAULT_SOLAR_WM2_NIGHT,
  DEFAULT_WIND_MS,
} from "./constants";

export function estimateWbgt(
  temperatureC: number,
  humidityPct: number,
  solarWm2: number,
  windMs: number,
): number {
  const solarKwm2 = solarWm2 / 1000;
  return (
    0.735 * temperatureC +
    0.0374 * humidityPct +
    0.00292 * temperatureC * humidityPct +
    7.619 * solarKwm2 -
    4.557 * solarKwm2 ** 2 -
    0.0572 * windMs -
    4.064
  );
}

export function fallbackSolarWm2(hour: number): number {
  if (hour >= 6 && hour < 18) {
    return DEFAULT_SOLAR_WM2_DAY;
  }
  return DEFAULT_SOLAR_WM2_NIGHT;
}

export function fallbackWindMs(): number {
  return DEFAULT_WIND_MS;
}
