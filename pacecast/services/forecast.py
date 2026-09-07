"""Open-Meteo から指定日時の予報を取得する。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import httpx

from pacecast.config import DEFAULT_LATITUDE, DEFAULT_LONGITUDE, DEFAULT_TIMEZONE


@dataclass(frozen=True)
class ForecastCondition:
    """1時刻分の予報。"""

    observed_at: datetime
    temperature_c: float
    humidity_pct: float
    location_label: str


class ForecastError(Exception):
    """予報取得に失敗したときの例外。"""


def _parse_hourly_time(text: str) -> datetime:
    """
    Open-Meteo の時刻文字列を datetime にする。

    Args:
        text: `YYYY-MM-DDTHH:MM` 形式。

    Returns:
        タイムゾーンなしの datetime。
    """
    return datetime.fromisoformat(text)


def fetch_forecast_condition(
    target_at: datetime,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    location_label: str = "練馬",
) -> ForecastCondition:
    """
    指定日時に最も近い時別予報を取得する。

    Args:
        target_at: 予測したい日時。
        latitude: 地点の緯度。
        longitude: 地点の経度。
        location_label: 画面表示用の地点名。

    Returns:
        最も近い時刻の気温・湿度。

    Raises:
        ForecastError: API 呼び出しや応答の解釈に失敗したとき。
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m",
        "timezone": DEFAULT_TIMEZONE,
        "forecast_days": 16,
    }
    try:
        response = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=15.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise ForecastError("天気予報の取得に失敗しました") from exc

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    temperatures = hourly.get("temperature_2m") or []
    humidities = hourly.get("relative_humidity_2m") or []
    if not times or len(times) != len(temperatures) or len(times) != len(humidities):
        raise ForecastError("天気予報の形式を解釈できませんでした")

    best_index = None
    best_delta = None
    for index, time_text in enumerate(times):
        if temperatures[index] is None or humidities[index] is None:
            continue
        moment = _parse_hourly_time(time_text)
        delta = abs((moment - target_at).total_seconds())
        if best_delta is None or delta < best_delta:
            best_delta = delta
            best_index = index

    if best_index is None or best_delta is None:
        raise ForecastError("指定日時の予報が見つかりませんでした")
    if best_delta > 90 * 60:
        raise ForecastError("指定日時は予報の対象期間外です")

    return ForecastCondition(
        observed_at=_parse_hourly_time(times[best_index]),
        temperature_c=float(temperatures[best_index]),
        humidity_pct=float(humidities[best_index]),
        location_label=location_label,
    )
