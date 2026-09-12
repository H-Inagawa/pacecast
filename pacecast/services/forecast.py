"""Open-Meteo から時別の気温・湿度・風速・日射を取得する。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

import httpx

from pacecast.config import DEFAULT_LATITUDE, DEFAULT_LONGITUDE, DEFAULT_TIMEZONE, MATCH_MAX_DELTA_MINUTES

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation"


@dataclass(frozen=True)
class ForecastCondition:
    """1時刻分の気象。"""

    observed_at: datetime
    temperature_c: float
    humidity_pct: float
    wind_ms: float | None
    solar_wm2: float | None
    location_label: str


class ForecastError(Exception):
    """予報・再解析の取得に失敗したときの例外。"""


def _parse_hourly_time(text: str) -> datetime:
    """
    Open-Meteo の時刻文字列を datetime にする。

    Args:
        text: `YYYY-MM-DDTHH:MM` 形式。

    Returns:
        タイムゾーンなしの datetime。
    """
    return datetime.fromisoformat(text)


def _pick_nearest(
    times: list[str],
    temperatures: list[float | None],
    humidities: list[float | None],
    winds: list[float | None],
    solars: list[float | None],
    target_at: datetime,
    location_label: str,
) -> ForecastCondition:
    """
    時系列から目標時刻に最も近い行を選ぶ。

    Args:
        times: 時刻文字列。
        temperatures: 気温。
        humidities: 湿度。
        winds: 風速（m/s）。
        solars: 全天日射（W/m²）。
        target_at: 目標時刻。
        location_label: 地点名。

    Returns:
        最も近い時刻の気象。

    Raises:
        ForecastError: 使える行が無い、または許容差を超えるとき。
    """
    best_index = None
    best_delta = None
    for index, time_text in enumerate(times):
        if index >= len(temperatures) or index >= len(humidities):
            continue
        if temperatures[index] is None or humidities[index] is None:
            continue
        moment = _parse_hourly_time(time_text)
        delta = abs((moment - target_at).total_seconds())
        if best_delta is None or delta < best_delta:
            best_delta = delta
            best_index = index

    if best_index is None or best_delta is None:
        raise ForecastError("指定日時の気象が見つかりませんでした")
    if best_delta > MATCH_MAX_DELTA_MINUTES * 60:
        raise ForecastError("指定日時は取得対象の期間外です")

    wind = winds[best_index] if best_index < len(winds) else None
    solar = solars[best_index] if best_index < len(solars) else None
    return ForecastCondition(
        observed_at=_parse_hourly_time(times[best_index]),
        temperature_c=float(temperatures[best_index]),
        humidity_pct=float(humidities[best_index]),
        wind_ms=None if wind is None else float(wind),
        solar_wm2=None if solar is None else float(solar),
        location_label=location_label,
    )


def _parse_hourly_payload(payload: dict, target_at: datetime, location_label: str) -> ForecastCondition:
    """
    Open-Meteo の hourly 応答から1時刻を取る。

    Args:
        payload: API の JSON。
        target_at: 目標時刻。
        location_label: 地点名。

    Returns:
        最も近い時刻の気象。

    Raises:
        ForecastError: 形式が不正なとき。
    """
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    temperatures = hourly.get("temperature_2m") or []
    humidities = hourly.get("relative_humidity_2m") or []
    winds = hourly.get("wind_speed_10m") or []
    solars = hourly.get("shortwave_radiation") or []
    if not times or len(times) != len(temperatures) or len(times) != len(humidities):
        raise ForecastError("気象データの形式を解釈できませんでした")
    return _pick_nearest(times, temperatures, humidities, winds, solars, target_at, location_label)


def fetch_forecast_condition(
    target_at: datetime,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    location_label: str = "練馬",
) -> ForecastCondition:
    """
    指定日時に最も近い時別予報（直近過去を含む）を取得する。

    Args:
        target_at: 予測したい日時。
        latitude: 地点の緯度。
        longitude: 地点の経度。
        location_label: 画面表示用の地点名。

    Returns:
        最も近い時刻の気温・湿度・風速・日射。

    Raises:
        ForecastError: API 呼び出しや応答の解釈に失敗したとき。
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": HOURLY_VARS,
        "timezone": DEFAULT_TIMEZONE,
        "forecast_days": 16,
        "past_days": 7,
        "wind_speed_unit": "ms",
    }
    try:
        response = httpx.get(FORECAST_URL, params=params, timeout=20.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise ForecastError("天気予報の取得に失敗しました") from exc
    return _parse_hourly_payload(payload, target_at, location_label)


def fetch_archive_condition(
    target_at: datetime,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    location_label: str = "練馬",
) -> ForecastCondition:
    """
    指定日時に最も近い再解析（過去）の時別値を取得する。

    Args:
        target_at: 欲しい日時。
        latitude: 地点の緯度。
        longitude: 地点の経度。
        location_label: 地点名。

    Returns:
        最も近い時刻の気象。

    Raises:
        ForecastError: 取得や解釈に失敗したとき。
    """
    day = target_at.date()
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": HOURLY_VARS,
        "timezone": DEFAULT_TIMEZONE,
        "start_date": day.isoformat(),
        "end_date": day.isoformat(),
        "wind_speed_unit": "ms",
    }
    try:
        response = httpx.get(ARCHIVE_URL, params=params, timeout=30.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise ForecastError("過去気象の取得に失敗しました") from exc
    return _parse_hourly_payload(payload, target_at, location_label)


def fetch_archive_range(
    start_day: date,
    end_day: date,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    location_label: str = "練馬",
) -> list[ForecastCondition]:
    """
    期間内の時別再解析をまとめて取得する。

    Args:
        start_day: 開始日。
        end_day: 終了日（含む）。
        latitude: 緯度。
        longitude: 経度。
        location_label: 地点名。

    Returns:
        時別の気象リスト。

    Raises:
        ForecastError: 取得や解釈に失敗したとき。
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": HOURLY_VARS,
        "timezone": DEFAULT_TIMEZONE,
        "start_date": start_day.isoformat(),
        "end_date": end_day.isoformat(),
        "wind_speed_unit": "ms",
    }
    try:
        response = httpx.get(ARCHIVE_URL, params=params, timeout=60.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise ForecastError("過去気象の取得に失敗しました") from exc

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    temperatures = hourly.get("temperature_2m") or []
    humidities = hourly.get("relative_humidity_2m") or []
    winds = hourly.get("wind_speed_10m") or []
    solars = hourly.get("shortwave_radiation") or []
    rows: list[ForecastCondition] = []
    for index, time_text in enumerate(times):
        if index >= len(temperatures) or index >= len(humidities):
            continue
        if temperatures[index] is None or humidities[index] is None:
            continue
        wind = winds[index] if index < len(winds) else None
        solar = solars[index] if index < len(solars) else None
        rows.append(
            ForecastCondition(
                observed_at=_parse_hourly_time(time_text),
                temperature_c=float(temperatures[index]),
                humidity_pct=float(humidities[index]),
                wind_ms=None if wind is None else float(wind),
                solar_wm2=None if solar is None else float(solar),
                location_label=location_label,
            )
        )
    return rows


def fetch_condition_for_time(
    target_at: datetime,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    location_label: str = "練馬",
) -> ForecastCondition:
    """
    予報または再解析から、指定時刻に近い気象を取る。

    直近1週間と未来は予報 API、それより前はアーカイブを使う。

    Args:
        target_at: 欲しい日時。
        latitude: 緯度。
        longitude: 経度。
        location_label: 地点名。

    Returns:
        最も近い時刻の気象。

    Raises:
        ForecastError: どちらからも取れないとき。
    """
    now = datetime.now()
    recent_start = now - timedelta(days=6)
    if target_at >= recent_start:
        try:
            return fetch_forecast_condition(target_at, latitude, longitude, location_label)
        except ForecastError:
            if target_at > now:
                raise
    return fetch_archive_condition(target_at, latitude, longitude, location_label)


def nearest_condition(
    rows: list[ForecastCondition],
    target_at: datetime,
) -> ForecastCondition | None:
    """
    事前取得した時別値から最近傍を返す。

    Args:
        rows: 時別値。
        target_at: 目標時刻。

    Returns:
        90 分以内の最近傍。無ければ None。
    """
    best: ForecastCondition | None = None
    best_delta: float | None = None
    limit = MATCH_MAX_DELTA_MINUTES * 60
    for row in rows:
        delta = abs((row.observed_at - target_at).total_seconds())
        if delta > limit:
            continue
        if best_delta is None or delta < best_delta:
            best = row
            best_delta = delta
    return best
