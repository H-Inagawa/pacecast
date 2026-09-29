"""心拍補正と一般・個人 WBGT を混ぜた予測。"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

PERSONAL_PRIOR_K = 10
MIN_PERSONAL_HR_RUNS = 6
HALF_LIFE_DAYS = 180
WBGT_SIGMA = 5.0
DISTANCE_SIGMA = 5.0
HR_SIGMA = 10.0
PACE_SIGMA_SEC = 30.0
SLOW_EFFECT_SCALE = 1.5
CURVE_POINTS = 21

# Figure S1（PMC8677617）の概形を目視で読んだ近似。単位は 1℃ あたりのタイム割合。
BANDS: tuple[dict[str, float], ...] = (
    {"distance_km": 5.0, "optimal_wbgt": 15.0, "hot_slope": 0.0018, "cold_slope": 0.0012, "elite_pace": 180.0, "slow_pace": 300.0},
    {"distance_km": 10.0, "optimal_wbgt": 12.0, "hot_slope": 0.0020, "cold_slope": 0.0013, "elite_pace": 180.0, "slow_pace": 300.0},
    {"distance_km": 21.0975, "optimal_wbgt": 10.0, "hot_slope": 0.0026, "cold_slope": 0.0015, "elite_pace": 200.0, "slow_pace": 340.0},
    {"distance_km": 42.195, "optimal_wbgt": 10.0, "hot_slope": 0.0030, "cold_slope": 0.0016, "elite_pace": 185.0, "slow_pace": 340.0},
)


@dataclass(frozen=True)
class PersonalRun:
    """個人予測に使う1走。"""

    record_id: int
    started_at: datetime
    distance_km: float
    duration_sec: int
    avg_heart_rate: float
    wbgt_c: float


@dataclass(frozen=True)
class PersonalPoint:
    """グラフの1点。"""

    x: float
    pace_sec_per_km: float


@dataclass(frozen=True)
class PersonalFit:
    """個人 WBGT モデルの予測。"""

    predicted_pace_sec_per_km: float
    general_effect: float
    personal_effect: float
    final_effect: float
    alpha: float
    class_sample_count: int
    sample_count: int
    r_squared: float
    rmse_sec_per_km: float
    formula: str
    heart_rate_adjusted: bool
    ranked: list[tuple[int, float]]
    wbgt_observed: list[PersonalPoint]
    wbgt_curve: list[PersonalPoint]
    hr_observed: list[PersonalPoint]
    hr_curve: list[PersonalPoint]


def _clamp(value: float, low: float, high: float) -> float:
    """値を範囲に収める。"""
    return min(high, max(low, value))


def _days_between(as_of: datetime, started: datetime) -> float:
    """基準日時からの経過日数。未来の走は 0。"""
    return max(0.0, (as_of - started).total_seconds() / 86_400)


def _kernel(delta: float, sigma: float) -> float:
    """差が大きいほど小さい重み。"""
    return math.exp(-abs(delta) / sigma)


def _lerp(start: float, end: float, ratio: float) -> float:
    """線形補間。"""
    return start + (end - start) * ratio


def _band_at(distance_km: float) -> dict[str, float]:
    """距離に対応する一般 WBGT の係数。"""
    if distance_km <= BANDS[0]["distance_km"]:
        return BANDS[0]
    if distance_km >= BANDS[-1]["distance_km"]:
        return BANDS[-1]
    for index in range(len(BANDS) - 1):
        left = BANDS[index]
        right = BANDS[index + 1]
        if distance_km <= right["distance_km"]:
            ratio = (distance_km - left["distance_km"]) / (right["distance_km"] - left["distance_km"])
            return {
                "distance_km": distance_km,
                "optimal_wbgt": _lerp(left["optimal_wbgt"], right["optimal_wbgt"], ratio),
                "hot_slope": _lerp(left["hot_slope"], right["hot_slope"], ratio),
                "cold_slope": _lerp(left["cold_slope"], right["cold_slope"], ratio),
                "elite_pace": _lerp(left["elite_pace"], right["elite_pace"], ratio),
                "slow_pace": _lerp(left["slow_pace"], right["slow_pace"], ratio),
            }
    return BANDS[-1]


def _ability_scale(pace_sec_per_km: float, band: dict[str, float]) -> float:
    """遅い走ほど一般補正の傾きを大きくする倍率。"""
    if pace_sec_per_km <= band["elite_pace"]:
        return 1.0
    if pace_sec_per_km >= band["slow_pace"]:
        return SLOW_EFFECT_SCALE
    ratio = (pace_sec_per_km - band["elite_pace"]) / (band["slow_pace"] - band["elite_pace"])
    return _lerp(1.0, SLOW_EFFECT_SCALE, ratio)


def _piecewise(wbgt: float, optimal: float, hot_slope: float, cold_slope: float) -> float:
    """最適 WBGT からのタイム割合。"""
    if wbgt >= optimal:
        return (wbgt - optimal) * hot_slope
    return (optimal - wbgt) * cold_slope


def _general_effect(distance_km: float, wbgt: float, pace_sec_per_km: float) -> float:
    """一般 WBGT 補正（タイム割合）。"""
    band = _band_at(distance_km)
    scale = _ability_scale(pace_sec_per_km, band)
    return _clamp(
        _piecewise(wbgt, band["optimal_wbgt"], band["hot_slope"] * scale, band["cold_slope"] * scale),
        -0.15,
        0.5,
    )


def _weighted_line(xs: list[float], ys: list[float], weights: list[float]) -> tuple[float, float] | None:
    """重み付き直線 y = a + b x。解けなければ None。"""
    sw = sx = sy = sxx = sxy = 0.0
    for x_value, y_value, weight in zip(xs, ys, weights, strict=True):
        if not weight > 0:
            continue
        sw += weight
        sx += weight * x_value
        sy += weight * y_value
        sxx += weight * x_value * x_value
        sxy += weight * x_value * y_value
    denom = sw * sxx - sx * sx
    if not sw > 0 or abs(denom) < 1e-9:
        return None
    slope = (sw * sxy - sx * sy) / denom
    intercept = (sy - slope * sx) / sw
    return intercept, slope


def _weighted_slope(xs: list[float], ys: list[float], weights: list[float]) -> float:
    """点が 3 未満なら傾き 0。"""
    if len(xs) < 3:
        return 0.0
    fitted = _weighted_line(xs, ys, weights)
    if fitted is None:
        return 0.0
    return fitted[1]


def _heart_rate_formula(line: tuple[float, float] | None, used: bool) -> str:
    """
    心拍と速度の回帰式を画面用の文にする。

    Args:
        line: 切片と傾き。直線が引けないときは None。
        used: 予測でこの直線を使ったか。

    Returns:
        速度の式。使っていないときは、その旨を次の行に足す。
    """
    if line is None:
        return "心拍とペースの傾きが使えないため、記録のペースをそのまま重み付け"
    intercept, slope = line
    magnitude = f"{abs(slope):.3f}"
    term = f"− {magnitude}" if slope < 0 else f"+ {magnitude}"
    equation = f"速度(km/h) = {intercept:.2f} {term} × 心拍"
    if used:
        return equation
    return f"{equation}\n心拍とペースの傾きが使えないため、記録のペースをそのまま重み付け"


def _linspace(low: float, high: float, count: int = CURVE_POINTS) -> list[float]:
    """等間隔の点。"""
    if count < 2 or abs(high - low) < 1e-9:
        return [low]
    step = (high - low) / (count - 1)
    return [low + step * index for index in range(count)]


def _bin_of(value: float) -> float:
    """5 刻みの階級の下端。"""
    return math.floor(value / 5) * 5


def _class_factor(distance_km: float, wbgt: float, target_distance: float, target_wbgt: float) -> float:
    """同じ階級は 1、隣は 0.5、それ以外は 0。"""
    steps = max(
        abs(_bin_of(distance_km) - _bin_of(target_distance)) / 5,
        abs(_bin_of(wbgt) - _bin_of(target_wbgt)) / 5,
    )
    if steps == 0:
        return 1.0
    if steps == 1:
        return 0.5
    return 0.0


def try_personal_prediction(
    runs: list[PersonalRun],
    target_wbgt: float,
    distance_km: float,
    target_hr: float,
    as_of: datetime,
) -> PersonalFit | None:
    """
    目標心拍と WBGT・距離からペース（秒/km）を推定する。

    Args:
        runs: 心拍と推定 WBGT がある過去走。
        target_wbgt: 予測する推定 WBGT（℃）。
        distance_km: 予測する距離（km）。
        target_hr: 目標心拍（bpm）。
        as_of: 直近重みの基準日時。

    Returns:
        予測。心拍の傾きが使えないときは None。
    """
    if len(runs) < MIN_PERSONAL_HR_RUNS:
        return None
    proximity = [
        (2 ** (-_days_between(as_of, run.started_at) / HALF_LIFE_DAYS))
        * _kernel(run.wbgt_c - target_wbgt, WBGT_SIGMA)
        * _kernel(run.distance_km - distance_km, DISTANCE_SIGMA)
        * _kernel(run.avg_heart_rate - target_hr, HR_SIGMA)
        for run in runs
    ]
    speeds = [run.distance_km / (run.duration_sec / 3600) for run in runs]
    line = _weighted_line([run.avg_heart_rate for run in runs], speeds, proximity)
    intercept, slope = line if line is not None else (0.0, 0.0)

    def speed_at(heart_rate: float) -> float:
        return intercept + slope * heart_rate

    heart_rate_adjusted = (
        line is not None
        and slope > 0
        and speed_at(target_hr) > 0.5
        and all(speed_at(run.avg_heart_rate) > 0.5 for run in runs)
    )
    adjusted: list[float] = []
    for run in runs:
        pace = run.duration_sec / run.distance_km
        if not heart_rate_adjusted:
            adjusted.append(pace)
        else:
            adjusted.append(pace * (speed_at(run.avg_heart_rate) / speed_at(target_hr)))

    neutral = [
        pace / (1 + _general_effect(run.distance_km, run.wbgt_c, pace))
        for pace, run in zip(adjusted, runs, strict=True)
    ]
    fastest = min(neutral)
    base_weights = []
    for pace, run in zip(neutral, runs, strict=True):
        recency = 2 ** (-_days_between(as_of, run.started_at) / HALF_LIFE_DAYS)
        base_weights.append(
            math.exp(-(pace - fastest) / PACE_SIGMA_SEC)
            * recency
            * _kernel(run.wbgt_c - target_wbgt, WBGT_SIGMA)
            * _kernel(run.distance_km - distance_km, DISTANCE_SIGMA)
        )
    weight_sum = sum(base_weights)
    if not weight_sum > 0:
        return None
    base_pace = sum(pace * weight for pace, weight in zip(neutral, base_weights, strict=True)) / weight_sum
    if not base_pace > 0:
        return None

    optimal = _band_at(distance_km)["optimal_wbgt"]
    cold_x: list[float] = []
    cold_y: list[float] = []
    cold_w: list[float] = []
    hot_x: list[float] = []
    hot_y: list[float] = []
    hot_w: list[float] = []
    for pace, run, weight in zip(adjusted, runs, proximity, strict=True):
        y_value = math.log(pace)
        if run.wbgt_c < optimal:
            cold_x.append(optimal - run.wbgt_c)
            cold_y.append(y_value)
            cold_w.append(weight)
        else:
            hot_x.append(run.wbgt_c - optimal)
            hot_y.append(y_value)
            hot_w.append(weight)
    cold_slope = max(0.0, _weighted_slope(cold_x, cold_y, cold_w))
    hot_slope = max(0.0, _weighted_slope(hot_x, hot_y, hot_w))

    def personal_at(wbgt: float) -> float:
        return _clamp(_piecewise(wbgt, optimal, hot_slope, cold_slope), -0.15, 0.5)

    n_eff = 0.0
    class_count = 0
    for run in runs:
        factor = _class_factor(run.distance_km, run.wbgt_c, distance_km, target_wbgt)
        if factor == 1:
            class_count += 1
        recency = 2 ** (-_days_between(as_of, run.started_at) / HALF_LIFE_DAYS)
        kernel_weight = recency * _kernel(run.wbgt_c - target_wbgt, WBGT_SIGMA) * _kernel(run.distance_km - distance_km, DISTANCE_SIGMA)
        n_eff += kernel_weight * factor
    alpha = n_eff / (n_eff + PERSONAL_PRIOR_K)
    general = _general_effect(distance_km, target_wbgt, base_pace)
    personal = personal_at(target_wbgt)
    final_effect = _clamp((1 - alpha) * general + alpha * personal, -0.15, 0.5)
    predicted = base_pace * (1 + final_effect)

    def blend_at(wbgt: float) -> float:
        return _clamp((1 - alpha) * _general_effect(distance_km, wbgt, base_pace) + alpha * personal_at(wbgt), -0.15, 0.5)

    predicted_at = [base_pace * (1 + blend_at(run.wbgt_c)) for run in runs]
    mean = sum(pace * weight for pace, weight in zip(adjusted, base_weights, strict=True)) / weight_sum
    ss_tot = sum(weight * (pace - mean) ** 2 for pace, weight in zip(adjusted, base_weights, strict=True))
    ss_res = sum(weight * (pace - pred) ** 2 for pace, pred, weight in zip(adjusted, predicted_at, base_weights, strict=True))
    r_squared = 1 - ss_res / ss_tot if ss_tot > 1e-9 else 0.0
    rmse = math.sqrt(ss_res / weight_sum)

    optimal = _band_at(distance_km)["optimal_wbgt"]
    wbgt_values = [run.wbgt_c for run in runs]
    hr_values = [run.avg_heart_rate for run in runs]
    wbgt_low = min([*wbgt_values, target_wbgt, optimal - 2])
    wbgt_high = max([*wbgt_values, target_wbgt, optimal + 2])
    hr_low = min([*hr_values, target_hr]) - 5
    hr_high = max([*hr_values, target_hr]) + 5
    hr_xs = _linspace(hr_low, hr_high) if line is not None else []
    hr_curve = (
        [PersonalPoint(heart_rate, 3600 / speed_at(heart_rate)) for heart_rate in hr_xs]
        if hr_xs and all(speed_at(heart_rate) > 0.5 for heart_rate in hr_xs)
        else []
    )
    formula = _heart_rate_formula(line, heart_rate_adjusted)
    ranked = sorted(
        ((run.record_id, weight) for run, weight in zip(runs, base_weights, strict=True)),
        key=lambda item: item[1],
        reverse=True,
    )
    return PersonalFit(
        predicted_pace_sec_per_km=predicted,
        general_effect=general,
        personal_effect=personal,
        final_effect=final_effect,
        alpha=alpha,
        class_sample_count=class_count,
        sample_count=len(runs),
        r_squared=r_squared,
        rmse_sec_per_km=rmse,
        formula=formula,
        heart_rate_adjusted=heart_rate_adjusted,
        ranked=ranked,
        wbgt_observed=[PersonalPoint(run.wbgt_c, pace) for run, pace in zip(runs, adjusted, strict=True)],
        wbgt_curve=[
            PersonalPoint(wbgt, base_pace * (1 + blend_at(wbgt)))
            for wbgt in _linspace(wbgt_low, wbgt_high)
        ],
        hr_observed=[PersonalPoint(run.avg_heart_rate, run.duration_sec / run.distance_km) for run in runs],
        hr_curve=hr_curve,
    )
