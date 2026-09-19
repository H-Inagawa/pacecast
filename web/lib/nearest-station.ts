import type { AmedasStation } from "./types";

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestStation(
  stations: AmedasStation[],
  latitude: number,
  longitude: number,
): AmedasStation | null {
  let best: AmedasStation | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const station of stations) {
    const km = distanceKm(latitude, longitude, station.latitude, station.longitude);
    if (km < bestKm) {
      best = station;
      bestKm = km;
    }
  }
  return best;
}
