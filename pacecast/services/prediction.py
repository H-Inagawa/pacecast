"""類似気象と走行強度の過去走からパフォーマンスを予測する。"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from pacecast.config import NEAR_WEATHER_DISTANCE
from pacecast.models import RunningRecord
from pacecast.services.intensity import MISSING_HR_PENALTY, heart_rate_distance


@dataclass(frozen=True)
class SimilarRun:
    """予測に使った過去走の要約。"""

    record_id: int
    started_at: str
    distance_km: float
    duration_sec: int
    pace_sec_per_km: float
    avg_heart_rate: int | None
    temperature_c: float
    humidity_pct: float
    weather_distance: float
    weight: float


@dataclass(frozen=True)
class PredictionResult:
    """予測結果。"""

    predicted_pace_sec_per_km: float
    predicted_duration_sec: int
    predicted_heart_rate: float | None
    confidence: str
    sample_count: int
    near_count: int
    used_runs: list[SimilarRun]
    intensity_key: str
    intensity_label: str


def weather_distance(temp_a: float, humidity_a: float, temp_b: float, humidity_b: float) -> float:
    """
    2つの気象条件の距離を返す。

    Args:
        temp_a: 気温 A（℃）。
        humidity_a: 湿度 A（％）。
        temp_b: 気温 B（℃）。
        humidity_b: 湿度 B（％）。

    Returns:
        気温差 1℃ または湿度差 5% を距離 1 とした値。
    """
    return abs(temp_a - temp_b) + abs(humidity_a - humidity_b) / 5.0


def _confidence(sample_count: int, near_count: int) -> str:
    """
    件数から信頼度ラベルを決める。

    Args:
        sample_count: 予測に使った全件数。
        near_count: 気象が近い件数。

    Returns:
        `high` / `medium` / `low`。
    """
    if sample_count >= 5 and near_count >= 5:
        return "high"
    if sample_count >= 3 and near_count >= 1:
        return "medium"
    return "low"


def predict_performance(
    db: Session,
    temperature_c: float,
    humidity_pct: float,
    distance_km: float,
    intensity_key: str = "medium",
    intensity_label: str = "中強度",
    target_hr: int | None = None,
) -> PredictionResult | None:
    """
    指定した気象・距離・走行強度に対するパフォーマンスを予測する。

    Args:
        db: DB セッション。
        temperature_c: 目標気温（℃）。
        humidity_pct: 目標湿度（％）。
        distance_km: 予測したい走行距離（km）。
        intensity_key: 走行強度キー。
        intensity_label: 画面表示用の強度名。
        target_hr: 目標心拍。無ければ気象のみで重み付けする。

    Returns:
        予測結果。気象付きの過去走が無ければ None。
    """
    records = db.scalars(
        select(RunningRecord)
        .options(joinedload(RunningRecord.weather))
        .where(RunningRecord.weather_observation_id.is_not(None))
    ).all()
    if not records:
        return None

    weighted: list[tuple[RunningRecord, float, float]] = []
    for record in records:
        weather = record.weather
        if weather is None:
            continue
        w_distance = weather_distance(
            temperature_c,
            humidity_pct,
            weather.temperature_c,
            weather.humidity_pct,
        )
        if target_hr is None:
            combined = w_distance
        elif record.avg_heart_rate is None:
            combined = w_distance + MISSING_HR_PENALTY
        else:
            combined = w_distance + heart_rate_distance(record.avg_heart_rate, target_hr)
        weight = 1.0 / (combined + 0.25)
        weighted.append((record, w_distance, weight))

    if not weighted:
        return None

    total_weight = sum(item[2] for item in weighted)
    pace = sum(record.pace_sec_per_km * weight for record, _d, weight in weighted) / total_weight
    near_count = sum(1 for _record, distance, _weight in weighted if distance <= NEAR_WEATHER_DISTANCE)
    used_runs = []
    for record, distance, weight in sorted(weighted, key=lambda item: item[1])[:8]:
        weather = record.weather
        assert weather is not None
        used_runs.append(
            SimilarRun(
                record_id=record.id,
                started_at=record.started_at.strftime("%Y-%m-%d %H:%M"),
                distance_km=record.distance_km,
                duration_sec=record.duration_sec,
                pace_sec_per_km=record.pace_sec_per_km,
                avg_heart_rate=record.avg_heart_rate,
                temperature_c=weather.temperature_c,
                humidity_pct=weather.humidity_pct,
                weather_distance=distance,
                weight=weight,
            )
        )

    return PredictionResult(
        predicted_pace_sec_per_km=pace,
        predicted_duration_sec=int(round(pace * distance_km)),
        predicted_heart_rate=float(target_hr) if target_hr is not None else None,
        confidence=_confidence(len(weighted), near_count),
        sample_count=len(weighted),
        near_count=near_count,
        used_runs=used_runs,
        intensity_key=intensity_key,
        intensity_label=intensity_label,
    )
