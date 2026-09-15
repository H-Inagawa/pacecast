import {
  DEFAULT_AMEDAS_STATION_ID,
  DEFAULT_AMEDAS_STATION_NAME,
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
  DEFAULT_TIMEZONE,
} from "../constants";

export const STATION_TABLE_URL = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json";
export const MAP_URL = "https://www.jma.go.jp/bosai/amedas/data/map/{stamp}.json";

export class AmedasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmedasError";
  }
}

export type AmedasStation = {
  stationId: string;
  name: string;
  elems: string;
  latitude: number;
  longitude: number;
};

export type AmedasObservation = {
  observedAt: Date;
  stationId: string;
  temperatureC: number | null;
  humidityPct: number | null;
  windMs: number | null;
  solarWm2: number | null;
};

type StationTable = Record<string, unknown>;

let stationTableCache: StationTable | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dmsToDecimal(parts: number[]): number {
  const degrees = Number(parts[0]);
  const minutes = parts.length > 1 ? Number(parts[1]) : 0;
  return degrees + minutes / 60;
}

function parseStation(stationId: string, payload: Record<string, unknown>): AmedasStation | null {
  const lat = payload.lat;
  const lon = payload.lon;
  const name = String(payload.kjName ?? "").trim();
  if (!name || !Array.isArray(lat) || !Array.isArray(lon)) {
    return null;
  }
  return {
    stationId: String(stationId),
    name,
    elems: String(payload.elems ?? ""),
    latitude: dmsToDecimal(lat.map(Number)),
    longitude: dmsToDecimal(lon.map(Number)),
  };
}

function defaultStation(): AmedasStation {
  return {
    stationId: DEFAULT_AMEDAS_STATION_ID,
    name: DEFAULT_AMEDAS_STATION_NAME,
    elems: "",
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
  };
}

export function stationSortKey(station: AmedasStation): [number, string] {
  if (!/^\d+$/.test(station.stationId)) {
    return [10 ** 9, station.stationId];
  }
  return [Number(station.stationId), station.stationId];
}

async function loadStationTable(forceRefresh = false): Promise<StationTable> {
  if (!forceRefresh && stationTableCache) {
    return stationTableCache;
  }
  try {
    const response = await fetch(STATION_TABLE_URL, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      throw new AmedasError("アメダス地点マスタの取得に失敗しました");
    }
    const payload = await response.json();
    if (!isRecord(payload)) {
      throw new AmedasError("アメダス地点マスタの取得に失敗しました");
    }
    stationTableCache = payload;
    return payload;
  } catch (error) {
    if (stationTableCache) {
      return stationTableCache;
    }
    if (error instanceof AmedasError) {
      throw error;
    }
    throw new AmedasError("アメダス地点マスタの取得に失敗しました");
  }
}

export async function listStations(): Promise<AmedasStation[]> {
  let table: StationTable;
  try {
    table = await loadStationTable();
  } catch (error) {
    if (error instanceof AmedasError) {
      return [defaultStation()];
    }
    throw error;
  }

  const stations: AmedasStation[] = [];
  for (const [stationId, payload] of Object.entries(table)) {
    if (!isRecord(payload)) {
      continue;
    }
    const station = parseStation(String(stationId), payload);
    if (station != null) {
      stations.push(station);
    }
  }
  stations.sort((a, b) => {
    const [aNum, aId] = stationSortKey(a);
    const [bNum, bId] = stationSortKey(b);
    if (aNum !== bNum) {
      return aNum - bNum;
    }
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });
  if (!stations.some((item) => item.stationId === DEFAULT_AMEDAS_STATION_ID)) {
    stations.unshift(defaultStation());
  }
  return stations;
}

export async function resolveStation(stationId: string | null | undefined): Promise<AmedasStation> {
  const wanted = (stationId ?? DEFAULT_AMEDAS_STATION_ID).trim() || DEFAULT_AMEDAS_STATION_ID;
  for (const station of await listStations()) {
    if (station.stationId === wanted) {
      return station;
    }
  }
  return defaultStation();
}

function amedasNumber(entry: unknown): number | null {
  if (!Array.isArray(entry) || entry.length === 0) {
    return null;
  }
  const value = entry[0];
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMapStation(
  payload: Record<string, unknown>,
  stationId: string,
  observedAt: Date,
): AmedasObservation {
  return {
    observedAt,
    stationId,
    temperatureC: amedasNumber(payload.temp),
    humidityPct: amedasNumber(payload.humidity),
    windMs: amedasNumber(payload.wind),
    solarWm2: amedasNumber(payload.sun ?? payload.radiation),
  };
}

function tokyoParts(moment: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(moment)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function floor10Min(moment: Date): Date {
  const parts = tokyoParts(moment);
  const minute = Math.floor(parts.minute / 10) * 10;
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(minute)}:00+09:00`,
  );
}

function formatStamp(moment: Date): string {
  const parts = tokyoParts(moment);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}${pad(parts.hour)}${pad(parts.minute)}00`;
}

export async function fetchMapObservation(
  stationId: string,
  targetAt: Date,
): Promise<AmedasObservation | null> {
  const observedAt = floor10Min(targetAt);
  const url = MAP_URL.replace("{stamp}", formatStamp(observedAt));
  let payload: unknown;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      return null;
    }
    payload = await response.json();
  } catch {
    return null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  const stationPayload = payload[stationId];
  if (!isRecord(stationPayload)) {
    return null;
  }
  return parseMapStation(stationPayload, stationId, observedAt);
}
