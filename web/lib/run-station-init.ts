import { requestCurrentPosition } from "./geolocation";
import { nearestStation } from "./nearest-station";
import type { AmedasStation } from "./types";

export const RUN_STATION_INIT_VALUES = ["profile", "gps"] as const;

export type RunStationInit = (typeof RUN_STATION_INIT_VALUES)[number];

export function normalizeRunStationInit(value: unknown): RunStationInit {
  return value === "gps" ? "gps" : "profile";
}

export async function initialRunStationId(input: {
  mode: RunStationInit | string | null | undefined;
  profileStationId: string | null | undefined;
  stations: AmedasStation[];
  requestPosition?: typeof requestCurrentPosition;
}): Promise<string> {
  const fallback = (input.profileStationId || "").trim() || "44132";
  if (normalizeRunStationInit(input.mode) !== "gps") {
    return fallback;
  }
  try {
    const here = await (input.requestPosition ?? requestCurrentPosition)();
    return nearestStation(input.stations, here.latitude, here.longitude)?.station_id || fallback;
  } catch {
    return fallback;
  }
}
