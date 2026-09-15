import { MATCH_MAX_DELTA_MINUTES, SAMPLE_AMEDAS_STATION_ID } from "../constants";
import { parseDbTimestamp } from "./datetime";
import type { WeatherRow } from "./types";

export function findNearestWeatherRow(
  rows: WeatherRow[],
  startedAt: Date,
  stationId?: string | null,
  maxDeltaMinutes = MATCH_MAX_DELTA_MINUTES,
): WeatherRow | null {
  const limitMs = maxDeltaMinutes * 60 * 1000;
  const candidates = rows.filter((row) => {
    const observed = parseDbTimestamp(row.observed_at);
    if (Math.abs(observed.getTime() - startedAt.getTime()) > limitMs) {
      return false;
    }
    if (!stationId) {
      return true;
    }
    if (stationId === SAMPLE_AMEDAS_STATION_ID) {
      return row.station_id === stationId || row.station_id == null || row.station_id === "";
    }
    return row.station_id === stationId;
  });
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, row) => {
    const bestDelta = Math.abs(parseDbTimestamp(best.observed_at).getTime() - startedAt.getTime());
    const rowDelta = Math.abs(parseDbTimestamp(row.observed_at).getTime() - startedAt.getTime());
    if (rowDelta < bestDelta) {
      return row;
    }
    if (rowDelta > bestDelta) {
      return best;
    }
    return parseDbTimestamp(row.observed_at).getTime() < parseDbTimestamp(best.observed_at).getTime()
      ? row
      : best;
  });
}
