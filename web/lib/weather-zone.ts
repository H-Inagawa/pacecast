export const WBGT_ZONE_TOO_COLD = "too_cold";
export const WBGT_ZONE_COLD = "cold";
export const WBGT_ZONE_COMFORT = "comfort";
export const WBGT_ZONE_HOT = "hot";
export const WBGT_ZONE_TOO_HOT = "too_hot";
export const WBGT_ZONE_NONE = "none";

export type WbgtZone =
  | typeof WBGT_ZONE_TOO_COLD
  | typeof WBGT_ZONE_COLD
  | typeof WBGT_ZONE_COMFORT
  | typeof WBGT_ZONE_HOT
  | typeof WBGT_ZONE_TOO_HOT
  | typeof WBGT_ZONE_NONE;

export function classifyWbgtZone(wbgtC: number | null | undefined): WbgtZone {
  if (wbgtC == null) {
    return WBGT_ZONE_NONE;
  }
  if (wbgtC < 10) {
    return WBGT_ZONE_TOO_COLD;
  }
  if (wbgtC < 15) {
    return WBGT_ZONE_COLD;
  }
  if (wbgtC < 21) {
    return WBGT_ZONE_COMFORT;
  }
  if (wbgtC < 28) {
    return WBGT_ZONE_HOT;
  }
  return WBGT_ZONE_TOO_HOT;
}
