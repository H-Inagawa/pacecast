import { FORECAST_DAYS, isForecastSlotHour } from "../runningForecast";
import { weatherCodeLabel } from "../weatherCode";
import { classifyWbgtZone, WBGT_FEEL_LABELS, type WbgtZone } from "../weatherZone";
import { estimateWbgt, fallbackSolarWm2, fallbackWindMs } from "../wbgt";
import { resolveStation } from "./amedas";
import { formatDateTimeSpace, tokyoParts } from "./datetime";
import { fetchForecastHours } from "./forecast";

export type RunningForecastHour = {
  observed_at: string;
  hour: number;
  weather_code: number | null;
  weather_label: string;
  weather_zone: Exclude<WbgtZone, "none">;
  feel_label: string;
  wbgt_c: number;
  temperature_c: number;
  humidity_pct: number;
  wind_ms: number;
  wind_dir_deg: number | null;
  solar_wm2: number;
};

export type RunningForecast = {
  station_id: string;
  station_name: string;
  hours: RunningForecastHour[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function tokyoMidnight(moment: Date): Date {
  const parts = tokyoParts(moment);
  return new Date(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}T00:00:00+09:00`);
}

export async function buildRunningForecast(stationId?: string | null): Promise<RunningForecast> {
  const station = await resolveStation(stationId);
  const start = tokyoMidnight(new Date());
  const end = new Date(start.getTime() + FORECAST_DAYS * 86400000);
  const fetched = await fetchForecastHours(station.latitude, station.longitude, FORECAST_DAYS + 1);
  const hours: RunningForecastHour[] = [];
  for (const row of fetched) {
    if (row.observedAt < start || row.observedAt >= end) {
      continue;
    }
    const parts = tokyoParts(row.observedAt);
    if (parts.minute !== 0 || !isForecastSlotHour(parts.hour)) {
      continue;
    }
    const wind = row.windMs ?? fallbackWindMs();
    const solar = row.solarWm2 ?? fallbackSolarWm2(parts.hour);
    const wbgt = estimateWbgt(row.temperatureC, row.humidityPct, solar, wind);
    const zone = classifyWbgtZone(wbgt);
    if (zone === "none") {
      continue;
    }
    hours.push({
      observed_at: formatDateTimeSpace(row.observedAt),
      hour: parts.hour,
      weather_code: row.weatherCode,
      weather_label: weatherCodeLabel(row.weatherCode),
      weather_zone: zone,
      feel_label: WBGT_FEEL_LABELS[zone],
      wbgt_c: Number(wbgt.toFixed(1)),
      temperature_c: row.temperatureC,
      humidity_pct: row.humidityPct,
      wind_ms: wind,
      wind_dir_deg: row.windDirDeg,
      solar_wm2: solar,
    });
  }
  return {
    station_id: station.stationId,
    station_name: station.name,
    hours,
  };
}
