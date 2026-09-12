"""推定 WBGT（小野・登内 2014 / 環境省の実況推定）の計算。"""

from __future__ import annotations

from pacecast.config import (
    DEFAULT_SOLAR_WM2_DAY,
    DEFAULT_SOLAR_WM2_NIGHT,
    DEFAULT_WIND_MS,
    WBGT_METHOD,
)
from pacecast.models import WeatherObservation


def estimate_wbgt(
    temperature_c: float,
    humidity_pct: float,
    solar_wm2: float,
    wind_ms: float,
) -> float:
    """
    気温・湿度・全天日射・風速から推定 WBGT を返す。

    環境省熱中症予防情報サイトの実況推定と同じ、小野・登内 (2014) の全国共通式。
    WBGT = 0.735Ta + 0.0374RH + 0.00292TaRH + 7.619SR - 4.557SR^2 - 0.0572WS - 4.064

    Args:
        temperature_c: 気温 Ta（℃）。
        humidity_pct: 相対湿度 RH（％）。
        solar_wm2: 全天日射量（W/m²）。式では kW/m² に換算する。
        wind_ms: 平均風速 WS（m/s）。

    Returns:
        推定 WBGT（℃）。
    """
    solar_kwm2 = solar_wm2 / 1000.0
    return (
        0.735 * temperature_c
        + 0.0374 * humidity_pct
        + 0.00292 * temperature_c * humidity_pct
        + 7.619 * solar_kwm2
        - 4.557 * solar_kwm2**2
        - 0.0572 * wind_ms
        - 4.064
    )


def fallback_solar_wm2(hour: int) -> float:
    """
    日射が取れないときの仮定値を返す。

    Args:
        hour: 0〜23 の時。

    Returns:
        昼間は 400 W/m²、夜間は 0 W/m²。
    """
    if 6 <= hour < 18:
        return DEFAULT_SOLAR_WM2_DAY
    return DEFAULT_SOLAR_WM2_NIGHT


def fallback_wind_ms() -> float:
    """
    風速が取れないときの仮定値を返す。

    Returns:
        既定の風速（m/s）。
    """
    return DEFAULT_WIND_MS


def apply_wbgt(row: WeatherObservation) -> bool:
    """
    気象行に推定 WBGT を書き込む。入力が欠けていれば空にする。

    Args:
        row: 更新対象の気象観測。

    Returns:
        WBGT を計算できたとき True。
    """
    if (
        row.temperature_c is None
        or row.humidity_pct is None
        or row.wind_ms is None
        or row.solar_wm2 is None
    ):
        row.wbgt_c = None
        row.wbgt_method = None
        return False
    row.wbgt_c = estimate_wbgt(row.temperature_c, row.humidity_pct, row.solar_wm2, row.wind_ms)
    row.wbgt_method = WBGT_METHOD
    return True
