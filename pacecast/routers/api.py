"""JSON API。画面は Next.js が担当する。"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from pacecast.db import get_db
from pacecast.formatting import duration_from_hms, parse_datetime_local, split_duration
from pacecast.models import RunningRecord, UserProfile, WeatherObservation
from pacecast.schemas import (
    AmedasStationOut,
    ForecastOut,
    IntensityHrs,
    IntensityOut,
    PredictIn,
    PredictOut,
    ProfileOut,
    ProfileWrite,
    RunOut,
    RunWrite,
    SimilarRunOut,
    WeatherBrief,
)
from pacecast.services.amedas import list_stations, resolve_station
from pacecast.services.forecast import ForecastError, fetch_forecast_condition
from pacecast.services.intensity import (
    INTENSITY_LABELS,
    RACE_DISTANCES_KM,
    list_custom_intensities,
    race_options,
    suggested_intensity_hrs,
)
from pacecast.services.prediction import predict_performance
from pacecast.services.profile import (
    effective_color_rows,
    get_or_create_profile,
    profile_age,
    profile_target_hrs,
    resolve_target_hr,
    run_zone,
    save_profile,
)
from pacecast.services.weather_sync import (
    backfill_run_wbgt,
    enrich_run_weather,
    profile_station,
    target_wbgt,
)

router = APIRouter(prefix="/api")

WEATHER_DISTANCE_HELP = (
    "予測対象の推定 WBGT と、その走の推定 WBGT の差です。"
    "過去走のほうが高い（暑い）と +、低い（涼しい）と - を付けます。"
    "0 に近いほど条件が似ています。単位は ℃ です。"
)


def _intensity_hrs(values: dict[str, int | None]) -> IntensityHrs:
    """
    強度別心拍の辞書をスキーマにする。

    Args:
        values: 強度キーと bpm。

    Returns:
        API 用の強度別心拍。
    """
    return IntensityHrs(
        low=values.get("low"),
        medium=values.get("medium"),
        high=values.get("high"),
        race_5k=values.get("race_5k"),
        race_10k=values.get("race_10k"),
        race_half=values.get("race_half"),
        race_full=values.get("race_full"),
    )


def _wbgt_counts(db: Session) -> tuple[int, int]:
    """
    走行件数と WBGT 付き件数を返す。

    Args:
        db: DB セッション。

    Returns:
        `(全走行件数, WBGT 付き件数)`。
    """
    run_count = db.scalar(select(func.count()).select_from(RunningRecord)) or 0
    ready = db.scalar(
        select(func.count())
        .select_from(RunningRecord)
        .join(WeatherObservation, RunningRecord.weather_observation_id == WeatherObservation.id)
        .where(WeatherObservation.wbgt_c.is_not(None))
    ) or 0
    return int(run_count), int(ready)


def _profile_out(profile: UserProfile, db: Session) -> ProfileOut:
    """
    プロフィールを API 用にする。

    Args:
        profile: 保存済み設定。
        db: DB セッション。

    Returns:
        設定画面・予測画面用の値。
    """
    stored = profile_target_hrs(profile)
    suggested = suggested_intensity_hrs(profile.max_heart_rate) if profile.max_heart_rate else {}
    station = profile_station(profile)
    run_count, ready = _wbgt_counts(db)
    return ProfileOut(
        display_name=profile.display_name,
        birthday=profile.birthday.isoformat() if profile.birthday else None,
        age=profile_age(profile),
        max_heart_rate=profile.max_heart_rate,
        color_rows=profile.color_rows,
        color_rows_effective=effective_color_rows(profile),
        intensities=_intensity_hrs(stored),
        suggested=_intensity_hrs({key: suggested.get(key) for key in stored}),
        custom_intensities=[
            IntensityOut(key=item.key, label=item.label, target_hr=item.target_hr, distance_km=item.distance_km)
            for item in list_custom_intensities(stored)
        ],
        race_options=[
            IntensityOut(key=item.key, label=item.label, target_hr=item.target_hr, distance_km=item.distance_km)
            for item in race_options(stored)
        ],
        amedas_station_id=station.station_id,
        amedas_station_name=station.name,
        wbgt_ready_count=ready,
        run_count=run_count,
    )


def _run_out(record: RunningRecord, profile: UserProfile | None = None) -> RunOut:
    """
    走行記録を API 用の形にする。

    Args:
        record: 走行記録。

    Returns:
        フロント向けの走行記録。
    """
    hours, minutes, seconds = split_duration(record.duration_sec)
    weather = None
    if record.weather is not None:
        weather = WeatherBrief(
            temperature_c=record.weather.temperature_c,
            humidity_pct=record.weather.humidity_pct,
            observed_at=record.weather.observed_at.strftime("%Y-%m-%d %H:%M"),
            wbgt_c=record.weather.wbgt_c,
        )
    return RunOut(
        id=record.id,
        started_at=record.started_at.strftime("%Y-%m-%dT%H:%M"),
        distance_km=record.distance_km,
        duration_sec=record.duration_sec,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        avg_heart_rate=record.avg_heart_rate,
        notes=record.notes,
        pace_sec_per_km=record.pace_sec_per_km,
        weather=weather,
        hr_zone=run_zone(profile, record.avg_heart_rate) if profile is not None else None,
        amedas_station_id=record.amedas_station_id,
        amedas_station_name=record.amedas_station_name,
    )


def _apply_write(record: RunningRecord, payload: RunWrite) -> RunningRecord:
    """
    入力を検証して記録へ書き込む。

    Args:
        record: 更新対象。新規なら未保存のインスタンス。
        payload: リクエスト本体。

    Returns:
        値を入れた走行記録。

    Raises:
        HTTPException: 入力が不正なとき。
    """
    try:
        started = parse_datetime_local(payload.started_at)
        duration_sec = duration_from_hms(payload.hours, payload.minutes, payload.seconds)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    heart_rate = payload.avg_heart_rate
    if heart_rate is not None and (heart_rate < 30 or heart_rate > 220):
        raise HTTPException(status_code=400, detail="平均心拍数は 30〜220 の範囲で入力してください")

    now = datetime.now()
    record.started_at = started
    record.distance_km = payload.distance_km
    record.duration_sec = duration_sec
    record.avg_heart_rate = heart_rate
    record.notes = (payload.notes or "").strip() or None
    if record.created_at is None:
        record.created_at = now
    record.updated_at = now
    return record


@router.get("/runs", response_model=list[RunOut])
def list_runs(db: Session = Depends(get_db)) -> list[RunOut]:
    """
    走行記録を新しい順で返す。

    Args:
        db: DB セッション。

    Returns:
        走行記録のリスト。
    """
    runs = db.scalars(
        select(RunningRecord)
        .options(joinedload(RunningRecord.weather))
        .order_by(RunningRecord.started_at.desc())
    ).all()
    profile = get_or_create_profile(db)
    return [_run_out(run, profile) for run in runs]


@router.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)) -> RunOut:
    """
    1件の走行記録を返す。

    Args:
        run_id: 記録 ID。
        db: DB セッション。

    Returns:
        走行記録。
    """
    record = db.get(RunningRecord, run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")
    return _run_out(record, get_or_create_profile(db))


@router.post("/runs", response_model=RunOut)
def create_run(payload: RunWrite, db: Session = Depends(get_db)) -> RunOut:
    """
    走行記録を新規保存する。

    Args:
        payload: 入力。
        db: DB セッション。

    Returns:
        保存した走行記録。
    """
    record = RunningRecord(
        started_at=datetime.now(),
        distance_km=payload.distance_km,
        duration_sec=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    _apply_write(record, payload)
    profile = get_or_create_profile(db)
    station = resolve_station(payload.amedas_station_id or profile.amedas_station_id)
    record.amedas_station_id = station.station_id
    record.amedas_station_name = station.name
    enrich_run_weather(db, record, station)
    db.add(record)
    db.commit()
    db.refresh(record)
    return _run_out(record, profile)


@router.put("/runs/{run_id}", response_model=RunOut)
def update_run(run_id: int, payload: RunWrite, db: Session = Depends(get_db)) -> RunOut:
    """
    走行記録を更新する。

    Args:
        run_id: 記録 ID。
        payload: 入力。
        db: DB セッション。

    Returns:
        更新後の走行記録。
    """
    record = db.get(RunningRecord, run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")
    _apply_write(record, payload)
    profile = get_or_create_profile(db)
    station = resolve_station(payload.amedas_station_id or record.amedas_station_id or profile.amedas_station_id)
    record.amedas_station_id = station.station_id
    record.amedas_station_name = station.name
    enrich_run_weather(db, record, station)
    db.commit()
    db.refresh(record)
    return _run_out(record, profile)


@router.delete("/runs/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    """
    走行記録を削除する。

    Args:
        run_id: 記録 ID。
        db: DB セッション。

    Returns:
        成功フラグ。
    """
    record = db.get(RunningRecord, run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")
    db.delete(record)
    db.commit()
    return {"ok": True}


@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)) -> ProfileOut:
    """
    設定を返す。

    Args:
        db: DB セッション。

    Returns:
        プロフィール。
    """
    return _profile_out(get_or_create_profile(db), db)


@router.get("/amedas/stations", response_model=list[AmedasStationOut])
def amedas_stations() -> list[AmedasStationOut]:
    """
    設定用のアメダス地点一覧を返す。

    Returns:
        観測所番号順の観測所。
    """
    return [
        AmedasStationOut(
            station_id=item.station_id,
            name=item.name,
            latitude=item.latitude,
            longitude=item.longitude,
        )
        for item in list_stations()
    ]


@router.put("/profile", response_model=ProfileOut)
def update_profile(payload: ProfileWrite, db: Session = Depends(get_db)) -> ProfileOut:
    """
    設定を保存する。確認ダイアログ後の確定値を受け取る。

    Args:
        payload: 設定値。
        db: DB セッション。

    Returns:
        保存後のプロフィール。
    """
    profile = get_or_create_profile(db)
    profile.display_name = (payload.display_name or "").strip() or None
    if payload.birthday:
        try:
            profile.birthday = date.fromisoformat(payload.birthday)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="誕生日の形式が正しくありません") from exc
    else:
        profile.birthday = None

    max_hr = payload.max_heart_rate
    if max_hr is not None and (max_hr < 80 or max_hr > 230):
        raise HTTPException(status_code=400, detail="最大心拍数は 80〜230 の範囲で入力してください")
    profile.max_heart_rate = max_hr
    profile.color_rows = False if max_hr is None else payload.color_rows

    intensities = payload.intensities
    profile.hr_low = intensities.low
    profile.hr_medium = intensities.medium
    profile.hr_high = intensities.high
    profile.hr_race_5k = intensities.race_5k
    profile.hr_race_10k = intensities.race_10k
    profile.hr_race_half = intensities.race_half
    profile.hr_race_full = intensities.race_full

    previous_station = profile.amedas_station_id
    if payload.amedas_station_id:
        station = resolve_station(payload.amedas_station_id)
        profile.amedas_station_id = station.station_id
        profile.amedas_station_name = station.name

    saved = save_profile(db, profile)
    if payload.amedas_station_id and payload.amedas_station_id != previous_station:
        backfill_run_wbgt(db, saved)
        db.refresh(saved)
    return _profile_out(saved, db)


@router.get("/intensities", response_model=ProfileOut)
def intensities(db: Session = Depends(get_db)) -> ProfileOut:
    """
    予測画面用の強度定義を返す。

    Args:
        db: DB セッション。

    Returns:
        プロフィールに紐づく強度。
    """
    return _profile_out(get_or_create_profile(db), db)


@router.post("/predict", response_model=PredictOut)
def predict(payload: PredictIn, db: Session = Depends(get_db)) -> PredictOut:
    """
    パフォーマンスを予測する。

    Args:
        payload: 距離・気象の与え方・強度。
        db: DB セッション。

    Returns:
        予測結果。
    """
    condition = None
    try:
        profile = get_or_create_profile(db)
        station = resolve_station(payload.amedas_station_id or profile.amedas_station_id)
        if payload.mode == "forecast":
            if not payload.forecast_at:
                raise ValueError("予報を使う日時を入力してください")
            forecast = fetch_forecast_condition(
                parse_datetime_local(payload.forecast_at),
                latitude=station.latitude,
                longitude=station.longitude,
                location_label=station.name,
            )
            temperature = forecast.temperature_c
            humidity = forecast.humidity_pct
            wbgt = target_wbgt(
                temperature,
                humidity,
                forecast.observed_at,
                station,
                forecast,
            )
            condition = ForecastOut(
                observed_at=forecast.observed_at.strftime("%Y-%m-%d %H:%M"),
                temperature_c=forecast.temperature_c,
                humidity_pct=forecast.humidity_pct,
                location_label=forecast.location_label,
                wind_ms=forecast.wind_ms,
                solar_wm2=forecast.solar_wm2,
                wbgt_c=wbgt,
            )
        else:
            if payload.temperature_c is None or payload.humidity_pct is None:
                raise ValueError("気温と湿度を入力してください")
            temperature = payload.temperature_c
            humidity = payload.humidity_pct
            if not (0 <= humidity <= 100):
                raise ValueError("湿度は 0〜100 の範囲で入力してください")
            wbgt = target_wbgt(temperature, humidity, datetime.now(), station)
        if payload.distance_mode == "race":
            race_key = payload.race or "race_5k"
            if race_key not in RACE_DISTANCES_KM:
                raise ValueError("レース種目の指定が正しくありません")
            distance = RACE_DISTANCES_KM[race_key]
            intensity_key = race_key
        else:
            if payload.distance_km is None:
                raise ValueError("距離は 0 より大きくしてください")
            distance = payload.distance_km
            intensity_key = payload.intensity
            if intensity_key not in ("low", "medium", "high"):
                raise ValueError("走行強度の指定が正しくありません")
        target_hr = resolve_target_hr(profile, intensity_key)
        intensity_label = INTENSITY_LABELS.get(intensity_key, intensity_key)
        result = predict_performance(
            db,
            wbgt,
            distance,
            intensity_key=intensity_key,
            intensity_label=intensity_label,
            target_hr=target_hr,
        )
    except (ValueError, ForecastError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=400, detail="WBGT が付いた走行記録がまだ無いため、予測できません")

    return PredictOut(
        predicted_pace_sec_per_km=result.predicted_pace_sec_per_km,
        predicted_duration_sec=result.predicted_duration_sec,
        predicted_heart_rate=result.predicted_heart_rate,
        confidence=result.confidence,
        sample_count=result.sample_count,
        near_count=result.near_count,
        intensity_key=result.intensity_key,
        intensity_label=result.intensity_label,
        used_runs=[
            SimilarRunOut(
                record_id=item.record_id,
                started_at=item.started_at,
                distance_km=item.distance_km,
                duration_sec=item.duration_sec,
                pace_sec_per_km=item.pace_sec_per_km,
                avg_heart_rate=item.avg_heart_rate,
                temperature_c=item.temperature_c,
                humidity_pct=item.humidity_pct,
                wbgt_c=item.wbgt_c,
                weather_distance=item.weather_distance,
                wbgt_delta=item.wbgt_delta,
            )
            for item in result.used_runs
        ],
        condition=condition,
        weather_distance_help=WEATHER_DISTANCE_HELP,
    )
