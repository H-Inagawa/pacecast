"""アメダス / Open-Meteo で気象行を補い、推定 WBGT を付ける。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from pacecast.config import DEFAULT_LOCATION
from pacecast.models import RunningRecord, UserProfile, WeatherObservation
from pacecast.services.amedas import AmedasStation, fetch_map_observation, resolve_station
from pacecast.services.forecast import (
    ForecastCondition,
    ForecastError,
    fetch_archive_range,
    fetch_condition_for_time,
    nearest_condition,
)
from pacecast.services.matching import attach_weather
from pacecast.services.wbgt import apply_wbgt, fallback_solar_wm2, fallback_wind_ms, estimate_wbgt


@dataclass(frozen=True)
class BackfillResult:
    """既存走への WBGT 付与結果。"""

    run_count: int
    with_wbgt: int
    without_wbgt: int
    failed_started_at: list[str]


def profile_station(profile: UserProfile) -> AmedasStation:
    """
    プロフィールに保存したアメダス地点を返す。

    Args:
        profile: ユーザー設定。

    Returns:
        観測所。未設定なら練馬。
    """
    return resolve_station(profile.amedas_station_id)


def ensure_profile_station(profile: UserProfile) -> AmedasStation:
    """
    地点が空なら練馬を書き込み、解決した地点を返す。

    Args:
        profile: ユーザー設定。

    Returns:
        観測所。
    """
    station = profile_station(profile)
    if not profile.amedas_station_id:
        profile.amedas_station_id = station.station_id
        profile.amedas_station_name = station.name
    return station


def target_wbgt(
    temperature_c: float,
    humidity_pct: float,
    at: datetime | None,
    station: AmedasStation,
    prefer: ForecastCondition | None = None,
) -> float:
    """
    予測条件の気温・湿度に、風と日射を足して推定 WBGT を返す。

    Args:
        temperature_c: 指定気温。
        humidity_pct: 指定湿度。
        at: 風・日射を取る時刻。省略時は現在。
        station: アメダス地点（緯度経度に使う）。
        prefer: すでに取得済みの時別値。

    Returns:
        推定 WBGT（℃）。
    """
    moment = at or datetime.now()
    wind = prefer.wind_ms if prefer is not None else None
    solar = prefer.solar_wm2 if prefer is not None else None
    if wind is None or solar is None:
        try:
            fetched = fetch_condition_for_time(moment, station.latitude, station.longitude, station.name)
        except ForecastError:
            fetched = None
        if fetched is not None:
            wind = wind if wind is not None else fetched.wind_ms
            solar = solar if solar is not None else fetched.solar_wm2
    if wind is None:
        wind = fallback_wind_ms()
    if solar is None:
        solar = fallback_solar_wm2(moment.hour)
    return estimate_wbgt(temperature_c, humidity_pct, solar, wind)


def _upsert_weather(
    db: Session,
    observed_at: datetime,
    location: str,
    station_id: str,
    temperature_c: float,
    humidity_pct: float,
    wind_ms: float | None,
    solar_wm2: float | None,
    source: str,
) -> WeatherObservation:
    """
    観測時刻で気象行を追加または更新する。

    Args:
        db: DB セッション。
        observed_at: 観測時刻。
        location: 地点名。
        station_id: アメダス ID。
        temperature_c: 気温。
        humidity_pct: 湿度。
        wind_ms: 風速。
        solar_wm2: 日射。
        source: 出典。

    Returns:
        保存した気象行。
    """
    row = db.scalar(
        select(WeatherObservation)
        .where(WeatherObservation.observed_at == observed_at)
        .where(WeatherObservation.station_id == station_id)
    )
    now = datetime.now()
    if row is None:
        row = WeatherObservation(
            observed_at=observed_at,
            location=location,
            temperature_c=temperature_c,
            humidity_pct=humidity_pct,
            source=source,
            imported_at=now,
        )
        db.add(row)
    else:
        row.location = location
        row.temperature_c = temperature_c
        row.humidity_pct = humidity_pct
        row.imported_at = now
        if source not in (row.source or ""):
            row.source = source
    row.station_id = station_id
    if wind_ms is not None:
        row.wind_ms = wind_ms
    if solar_wm2 is not None:
        row.solar_wm2 = solar_wm2
    apply_wbgt(row)
    db.flush()
    return row


def _fill_from_condition(
    row: WeatherObservation,
    condition: ForecastCondition,
    station: AmedasStation,
    overwrite_temp_humidity: bool,
) -> None:
    """
    Open-Meteo の1時刻で気象行の欠けを埋める。

    Args:
        row: 気象行。
        condition: 時別値。
        station: 地点。
        overwrite_temp_humidity: True なら気温・湿度も上書きする。

    Returns:
        なし。
    """
    if overwrite_temp_humidity:
        row.temperature_c = condition.temperature_c
        row.humidity_pct = condition.humidity_pct
    if row.wind_ms is None and condition.wind_ms is not None:
        row.wind_ms = condition.wind_ms
    if row.solar_wm2 is None and condition.solar_wm2 is not None:
        row.solar_wm2 = condition.solar_wm2
    row.station_id = station.station_id
    if not row.location:
        row.location = station.name
    apply_wbgt(row)


def enrich_weather_row(
    db: Session,
    row: WeatherObservation,
    station: AmedasStation,
    hourly: list[ForecastCondition] | None = None,
) -> bool:
    """
    1件の気象行に風・日射と WBGT を付ける。

    Args:
        db: DB セッション。
        row: 気象行。
        station: アメダス地点。
        hourly: 事前取得した再解析。あればネットワークを節約する。

    Returns:
        WBGT が付いたとき True。
    """
    del db
    if row.wbgt_c is not None:
        return True

    amedas = None
    if row.observed_at >= datetime.now() - timedelta(days=8):
        amedas = fetch_map_observation(station.station_id, row.observed_at)
    if amedas is not None:
        if row.wind_ms is None and amedas.wind_ms is not None:
            row.wind_ms = amedas.wind_ms
        if row.solar_wm2 is None and amedas.solar_wm2 is not None:
            row.solar_wm2 = amedas.solar_wm2
        row.station_id = station.station_id

    condition = nearest_condition(hourly, row.observed_at) if hourly else None
    if condition is None:
        try:
            condition = fetch_condition_for_time(
                row.observed_at,
                station.latitude,
                station.longitude,
                station.name,
            )
        except ForecastError:
            condition = None
    if condition is not None:
        _fill_from_condition(row, condition, station, overwrite_temp_humidity=False)

    if row.wind_ms is None:
        row.wind_ms = fallback_wind_ms()
    if row.solar_wm2 is None:
        row.solar_wm2 = fallback_solar_wm2(row.observed_at.hour)
    return apply_wbgt(row)


def enrich_run_weather(
    db: Session,
    record: RunningRecord,
    station: AmedasStation,
    hourly: list[ForecastCondition] | None = None,
) -> bool:
    """
    1件の走行に気象と WBGT を付ける。

    Args:
        db: DB セッション。
        record: 走行記録。
        station: アメダス地点。
        hourly: 事前取得した再解析。

    Returns:
        WBGT が付いたとき True。
    """
    attach_weather(db, record)
    weather = record.weather
    if weather is None:
        condition = nearest_condition(hourly, record.started_at) if hourly else None
        if condition is None:
            try:
                condition = fetch_condition_for_time(
                    record.started_at,
                    station.latitude,
                    station.longitude,
                    station.name,
                )
            except ForecastError:
                condition = None
        if condition is None:
            return False
        weather = _upsert_weather(
            db,
            observed_at=condition.observed_at,
            location=station.name or DEFAULT_LOCATION,
            station_id=station.station_id,
            temperature_c=condition.temperature_c,
            humidity_pct=condition.humidity_pct,
            wind_ms=condition.wind_ms,
            solar_wm2=condition.solar_wm2,
            source="open-meteo",
        )
        record.weather_observation_id = weather.id
        record.weather = weather
        return weather.wbgt_c is not None

    return enrich_weather_row(db, weather, station, hourly)


def backfill_run_wbgt(db: Session, profile: UserProfile | None = None) -> BackfillResult:
    """
    すべての走行にアメダス／再解析と推定 WBGT を付ける。

    Args:
        db: DB セッション。
        profile: 地点の入った設定。省略時は DB から読む。

    Returns:
        付与できた件数と、付かなかった開始日時。
    """
    if profile is None:
        from pacecast.services.profile import get_or_create_profile

        profile = get_or_create_profile(db)
    station = ensure_profile_station(profile)
    records = db.scalars(
        select(RunningRecord).options(joinedload(RunningRecord.weather)).order_by(RunningRecord.started_at.asc())
    ).all()
    if not records:
        db.commit()
        return BackfillResult(0, 0, 0, [])

    hourly: list[ForecastCondition] = []
    start_day = min(item.started_at for item in records).date()
    end_day = max(item.started_at for item in records).date()
    try:
        hourly = fetch_archive_range(
            start_day,
            end_day,
            station.latitude,
            station.longitude,
            station.name,
        )
    except ForecastError:
        hourly = []

    failed: list[str] = []
    with_wbgt = 0
    for record in records:
        if enrich_run_weather(db, record, station, hourly or None):
            with_wbgt += 1
        else:
            failed.append(record.started_at.strftime("%Y-%m-%d %H:%M"))

    db.commit()
    return BackfillResult(
        run_count=len(records),
        with_wbgt=with_wbgt,
        without_wbgt=len(records) - with_wbgt,
        failed_started_at=failed,
    )
