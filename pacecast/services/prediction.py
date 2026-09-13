"""推定 WBGT・距離・心拍の式モデルでパフォーマンスを予測する。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from pacecast.config import NEAR_WEATHER_DISTANCE
from pacecast.models import RunningRecord
from pacecast.services.regression import (
    FittedPaceModel,
    fit_pace_model,
    pace_sec_per_km,
    recency_weight,
)

MIN_HR_RUNS = 6
CURVE_POINTS = 21


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
    wbgt_c: float
    weather_distance: float
    wbgt_delta: float
    weight: float


@dataclass(frozen=True)
class ChartPoint:
    """関係グラフの1点。"""

    x: float
    pace_sec_per_km: float


@dataclass(frozen=True)
class RelationChart:
    """1変数とペースの関係。"""

    key: str
    title: str
    x_label: str
    note: str
    observed: list[ChartPoint]
    curve: list[ChartPoint]


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
    r_squared: float
    rmse_sec_per_km: float
    model_formula: str
    uses_hr: bool
    relation_charts: list[RelationChart]


def weather_distance(wbgt_a: float, wbgt_b: float) -> float:
    """
    2つの推定 WBGT の距離を返す。

    Args:
        wbgt_a: WBGT A（℃）。
        wbgt_b: WBGT B（℃）。

    Returns:
        絶対差。0 に近いほど暑さ条件が似ている。
    """
    return abs(wbgt_a - wbgt_b)


def _confidence_from_r2(r_squared: float) -> str:
    """
    決定係数から信頼度ラベルを決める。

    Args:
        r_squared: 重み付き R²。

    Returns:
        `high` / `medium` / `low`。
    """
    if r_squared >= 0.70:
        return "high"
    if r_squared >= 0.40:
        return "medium"
    return "low"


def _linspace(low: float, high: float, count: int = CURVE_POINTS) -> list[float]:
    """
    区間を等間隔に分割した値を返す。

    Args:
        low: 下限。
        high: 上限。
        count: 点数。

    Returns:
        分割点。上下が同じなら1点。
    """
    if count < 2 or abs(high - low) < 1e-9:
        return [low]
    step = (high - low) / (count - 1)
    return [low + step * index for index in range(count)]


def _curve(
    model: FittedPaceModel,
    key: str,
    xs: list[float],
    heart_rate: float,
    distance_km: float,
    wbgt_c: float,
) -> list[ChartPoint]:
    """
    1変数だけ動かしたモデル曲線を返す。

    Args:
        model: 当てはめたモデル。
        key: `wbgt` / `distance` / `heart_rate`。
        xs: 横軸の値。
        heart_rate: 固定する心拍。
        distance_km: 固定する距離。
        wbgt_c: 固定する WBGT。

    Returns:
        曲線の点。
    """
    points: list[ChartPoint] = []
    for value in xs:
        if key == "wbgt":
            kmh = model.predict_kmh(heart_rate, distance_km, value)
        elif key == "distance":
            kmh = model.predict_kmh(heart_rate, value, wbgt_c)
        else:
            kmh = model.predict_kmh(value, distance_km, wbgt_c)
        points.append(ChartPoint(x=value, pace_sec_per_km=pace_sec_per_km(kmh)))
    return points


def _relation_charts(
    model: FittedPaceModel,
    records: list[RunningRecord],
    heart_rate: float,
    distance_km: float,
    wbgt_c: float,
) -> list[RelationChart]:
    """
    WBGT・心拍・距離とペースの関係グラフを作る。

    Args:
        model: 当てはめたモデル。
        records: 学習に使った走。
        heart_rate: 予測の心拍。
        distance_km: 予測の距離。
        wbgt_c: 予測の WBGT。

    Returns:
        3本の関係グラフ。
    """
    wbgt_obs = [
        ChartPoint(x=record.weather.wbgt_c, pace_sec_per_km=record.pace_sec_per_km)
        for record in records
        if record.weather is not None and record.weather.wbgt_c is not None
    ]
    hr_obs = [
        ChartPoint(x=float(record.avg_heart_rate), pace_sec_per_km=record.pace_sec_per_km)
        for record in records
        if record.avg_heart_rate is not None
    ]
    dist_obs = [ChartPoint(x=record.distance_km, pace_sec_per_km=record.pace_sec_per_km) for record in records]

    def domain(points: list[ChartPoint], fallback: float) -> list[float]:
        if not points:
            return [fallback]
        xs = [point.x for point in points]
        return _linspace(min(xs), max(xs))

    wbgt_curve = _curve(model, "wbgt", domain(wbgt_obs, wbgt_c), heart_rate, distance_km, wbgt_c)
    dist_curve = _curve(model, "distance", domain(dist_obs, distance_km), heart_rate, distance_km, wbgt_c)
    hr_curve = (
        _curve(model, "heart_rate", domain(hr_obs, heart_rate), heart_rate, distance_km, wbgt_c)
        if model.uses_hr and hr_obs
        else []
    )
    return [
        RelationChart(
            key="wbgt",
            title="WBGT とペース",
            x_label="推定 WBGT（℃）",
            note="距離と心拍は予測条件で固定",
            observed=wbgt_obs,
            curve=wbgt_curve,
        ),
        RelationChart(
            key="heart_rate",
            title="心拍 とペース",
            x_label="平均心拍（bpm）",
            note="WBGT と距離は予測条件で固定" if model.uses_hr else "心拍付きが少ないため、今回の式に心拍は入れていません",
            observed=hr_obs,
            curve=hr_curve,
        ),
        RelationChart(
            key="distance",
            title="距離 とペース",
            x_label="距離（km）",
            note="WBGT と心拍は予測条件で固定",
            observed=dist_obs,
            curve=dist_curve,
        ),
    ]


def _to_similar(record: RunningRecord, target_wbgt: float, weight: float) -> SimilarRun:
    """
    根拠表用の過去走要約を作る。

    Args:
        record: 走行記録。
        target_wbgt: 予測対象の推定 WBGT。
        weight: 直近重み。

    Returns:
        根拠行。
    """
    weather = record.weather
    assert weather is not None and weather.wbgt_c is not None
    return SimilarRun(
        record_id=record.id,
        started_at=record.started_at.strftime("%Y-%m-%d %H:%M"),
        distance_km=record.distance_km,
        duration_sec=record.duration_sec,
        pace_sec_per_km=record.pace_sec_per_km,
        avg_heart_rate=record.avg_heart_rate,
        temperature_c=weather.temperature_c,
        humidity_pct=weather.humidity_pct,
        wbgt_c=weather.wbgt_c,
        weather_distance=weather_distance(target_wbgt, weather.wbgt_c),
        wbgt_delta=weather.wbgt_c - target_wbgt,
        weight=weight,
    )


def predict_performance(
    db: Session,
    wbgt_c: float,
    distance_km: float,
    intensity_key: str = "medium",
    intensity_label: str = "中強度",
    target_hr: int | None = None,
    auth_user_id: int | None = None,
    as_of: datetime | None = None,
) -> PredictionResult | None:
    """
    指定した推定 WBGT・距離・走行強度に対するパフォーマンスを予測する。

    Args:
        db: DB セッション。
        wbgt_c: 目標の推定 WBGT（℃）。
        distance_km: 予測したい走行距離（km）。
        intensity_key: 走行強度キー。
        intensity_label: 画面表示用の強度名。
        target_hr: 目標心拍。心拍項を使うときの入力。
        auth_user_id: 対象ランナー。省略時は全走行を使う（テスト用）。
        as_of: 直近重みの基準日時。省略時は現在。

    Returns:
        予測結果。WBGT 付きの過去走が無ければ None。
    """
    query = (
        select(RunningRecord)
        .options(joinedload(RunningRecord.weather))
        .where(RunningRecord.weather_observation_id.is_not(None))
    )
    if auth_user_id is not None:
        query = query.where(RunningRecord.auth_user_id == auth_user_id)
    records = db.scalars(query).all()
    eligible = [
        record
        for record in records
        if record.weather is not None and record.weather.wbgt_c is not None
    ]
    if not eligible:
        return None

    as_of_dt = as_of or datetime.now()
    hr_rows = [record for record in eligible if record.avg_heart_rate is not None]
    uses_hr = len(hr_rows) >= MIN_HR_RUNS
    fit_rows = hr_rows if uses_hr else eligible
    if len(fit_rows) < 2:
        return None

    model = fit_pace_model(
        heart_rates=[float(record.avg_heart_rate or 0) for record in fit_rows],
        distances=[record.distance_km for record in fit_rows],
        wbgts=[record.weather.wbgt_c for record in fit_rows if record.weather is not None],
        paces_sec=[record.pace_sec_per_km for record in fit_rows],
        weights=[recency_weight(record.started_at, as_of_dt) for record in fit_rows],
        uses_hr=uses_hr,
    )
    if model is None:
        return None

    predict_hr = float(target_hr) if target_hr is not None else (model.h_mean if uses_hr else 0.0)
    pace = pace_sec_per_km(model.predict_kmh(predict_hr, distance_km, wbgt_c))
    near_count = sum(
        1
        for record in eligible
        if record.weather is not None
        and record.weather.wbgt_c is not None
        and weather_distance(wbgt_c, record.weather.wbgt_c) <= NEAR_WEATHER_DISTANCE
    )
    used_runs = [
        _to_similar(record, wbgt_c, recency_weight(record.started_at, as_of_dt))
        for record in sorted(fit_rows, key=lambda item: item.started_at, reverse=True)[:8]
    ]

    return PredictionResult(
        predicted_pace_sec_per_km=pace,
        predicted_duration_sec=int(round(pace * distance_km)),
        predicted_heart_rate=float(target_hr) if target_hr is not None else None,
        confidence=_confidence_from_r2(model.r2),
        sample_count=len(fit_rows),
        near_count=near_count,
        used_runs=used_runs,
        intensity_key=intensity_key,
        intensity_label=intensity_label,
        r_squared=model.r2,
        rmse_sec_per_km=model.rmse_sec_per_km,
        model_formula=model.formula_text(),
        uses_hr=uses_hr,
        relation_charts=_relation_charts(model, fit_rows, predict_hr, distance_km, wbgt_c),
    )
