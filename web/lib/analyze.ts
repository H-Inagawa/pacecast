import type { Run } from "./types";

export type WbgtPacePoint = {
  runId: number;
  startedAt: string;
  wbgtC: number;
  paceSecPerKm: number;
};

export function wbgtPacePoints(runs: Run[]): WbgtPacePoint[] {
  return runs.flatMap((run) => {
    if (run.weather == null || run.weather.wbgt_c == null) {
      return [];
    }
    return [
      {
        runId: run.id,
        startedAt: run.started_at,
        wbgtC: run.weather.wbgt_c,
        paceSecPerKm: run.pace_sec_per_km,
      },
    ];
  });
}

export function paddedRange(values: number[], fallbackSpan = 2): [number, number] {
  if (values.length === 0) {
    return [0, fallbackSpan];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - fallbackSpan / 2, max + fallbackSpan / 2];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}
