"""走行一覧の推定 WBGT 色分け。"""

from __future__ import annotations

WBGT_ZONE_TOO_COLD = "too_cold"
WBGT_ZONE_COLD = "cold"
WBGT_ZONE_COMFORT = "comfort"
WBGT_ZONE_HOT = "hot"
WBGT_ZONE_TOO_HOT = "too_hot"
WBGT_ZONE_NONE = "none"


def classify_wbgt_zone(wbgt_c: float | None) -> str:
    """
    推定 WBGT から一覧の色分けゾーンを返す。

    境界は下側を含む。15℃ は快適、21℃ は暑い、28℃ は暑すぎる。

    Args:
        wbgt_c: 推定 WBGT（℃）。無いときは未関連と同じ扱い。

    Returns:
        ゾーンキー。値が無ければ `none`。
    """
    if wbgt_c is None:
        return WBGT_ZONE_NONE
    if wbgt_c < 10:
        return WBGT_ZONE_TOO_COLD
    if wbgt_c < 15:
        return WBGT_ZONE_COLD
    if wbgt_c < 21:
        return WBGT_ZONE_COMFORT
    if wbgt_c < 28:
        return WBGT_ZONE_HOT
    return WBGT_ZONE_TOO_HOT
