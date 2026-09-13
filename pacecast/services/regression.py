"""重み付き最小二乗法によるペース回帰。"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

RECENCY_LAMBDA_PER_DAY = 0.0075
MIN_RESIDUAL_DF = 2


def pace_kmh(pace_sec_per_km: float) -> float:
    """
    秒/km を km/h にする。

    Args:
        pace_sec_per_km: キロあたり秒。

    Returns:
        時速。
    """
    return 3600.0 / pace_sec_per_km


def pace_sec_per_km(pace_kmh: float) -> float:
    """
    km/h を秒/km にする。

    Args:
        pace_kmh: 時速。

    Returns:
        キロあたり秒。
    """
    return 3600.0 / max(pace_kmh, 0.1)


def recency_weight(started_at: datetime, as_of: datetime) -> float:
    """
    直近ほど大きい指数減衰の重みを返す。

    Args:
        started_at: 走行開始。
        as_of: 基準日時。

    Returns:
        1 に近いほど新しい。
    """
    days = max((as_of - started_at).total_seconds() / 86400.0, 0.0)
    return math.exp(-RECENCY_LAMBDA_PER_DAY * days)


@dataclass(frozen=True)
class Term:
    """回帰の1項。"""

    key: str
    label: str
    needs_hr: bool
    eval: Callable[[float, float, float], float]


TERMS: tuple[Term, ...] = (
    Term("1", "定数", False, lambda h, d, w: 1.0),
    Term("W", "WBGT", False, lambda h, d, w: w),
    Term("D", "距離", False, lambda h, d, w: d),
    Term("H", "心拍", True, lambda h, d, w: h),
    Term("WD", "WBGT×距離", False, lambda h, d, w: w * d),
    Term("WH", "WBGT×心拍", True, lambda h, d, w: w * h),
    Term("DH", "距離×心拍", True, lambda h, d, w: d * h),
    Term("W2", "WBGT²", False, lambda h, d, w: w * w),
    Term("D2", "距離²", False, lambda h, d, w: d * d),
    Term("H2", "心拍²", True, lambda h, d, w: h * h),
)


def _solve(matrix: list[list[float]], rhs: list[float]) -> list[float] | None:
    """
    連立方程式を解く。解けなければ None。

    Args:
        matrix: 係数行列。
        rhs: 右辺。

    Returns:
        解。特異なとき None。
    """
    n = len(rhs)
    work = [row[:] + [rhs[i]] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda row: abs(work[row][col]))
        if abs(work[pivot][col]) < 1e-10:
            return None
        work[col], work[pivot] = work[pivot], work[col]
        scale = work[col][col]
        for j in range(col, n + 1):
            work[col][j] /= scale
        for row in range(n):
            if row == col:
                continue
            factor = work[row][col]
            for j in range(col, n + 1):
                work[row][j] -= factor * work[col][j]
    return [work[i][n] for i in range(n)]


def _standardize(values: list[float], weights: list[float]) -> tuple[float, float]:
    """
    重み付き平均と標準偏差を返す。

    Args:
        values: 元の値。
        weights: 各行の重み。

    Returns:
        平均と標準偏差。分散がほぼ 0 なら偏差は 1。
    """
    total = sum(weights)
    mean = sum(weight * value for weight, value in zip(weights, values, strict=True)) / total
    var = sum(weight * (value - mean) ** 2 for weight, value in zip(weights, values, strict=True)) / total
    std = math.sqrt(var) if var > 1e-12 else 1.0
    return mean, std


@dataclass
class FittedPaceModel:
    """当てはめたペースモデル。"""

    terms: list[Term]
    coefficients: list[float]
    h_mean: float
    h_std: float
    d_mean: float
    d_std: float
    w_mean: float
    w_std: float
    r2: float
    rmse_sec_per_km: float
    uses_hr: bool

    def _scaled(self, heart_rate: float, distance_km: float, wbgt_c: float) -> tuple[float, float, float]:
        """
        標準化した説明変数を返す。

        Args:
            heart_rate: 心拍。
            distance_km: 距離。
            wbgt_c: 推定 WBGT。

        Returns:
            標準化した心拍・距離・WBGT。
        """
        return (
            (heart_rate - self.h_mean) / self.h_std,
            (distance_km - self.d_mean) / self.d_std,
            (wbgt_c - self.w_mean) / self.w_std,
        )

    def predict_kmh(self, heart_rate: float, distance_km: float, wbgt_c: float) -> float:
        """
        条件に対するペース（km/h）を返す。

        Args:
            heart_rate: 心拍。
            distance_km: 距離。
            wbgt_c: 推定 WBGT。

        Returns:
            時速。
        """
        scaled = self._scaled(heart_rate, distance_km, wbgt_c)
        total = 0.0
        for term, coef in zip(self.terms, self.coefficients, strict=True):
            total += coef * float(term.eval(*scaled))
        return max(total, 0.5)

    def formula_text(self) -> str:
        """
        使った項の説明を返す。

        Returns:
            日本語の式の概要。
        """
        names = " + ".join(term.label for term in self.terms if term.key != "1")
        if not names:
            return "直近ほど重い重み付き平均"
        return f"ペース(km/h) = 定数 + {names}（各変数は標準化）"


def choose_terms(sample_count: int, uses_hr: bool) -> list[Term]:
    """
    件数に対して入れられる項を、主効果→交差→2次の順で返す。

    Args:
        sample_count: 学習件数。
        uses_hr: 心拍を使うか。

    Returns:
        採用する項。
    """
    chosen: list[Term] = []
    for term in TERMS:
        if term.needs_hr and not uses_hr:
            continue
        if sample_count < len(chosen) + 1 + MIN_RESIDUAL_DF:
            break
        chosen.append(term)
    return chosen or [TERMS[0]]


def _usable_terms(
    terms: list[Term],
    heart_rates: list[float],
    distances: list[float],
    wbgts: list[float],
    h_mean: float,
    h_std: float,
    d_mean: float,
    d_std: float,
    w_mean: float,
    w_std: float,
) -> list[Term]:
    """
    学習データで値が動かない項を除く。

    Args:
        terms: 候補の項。
        heart_rates: 心拍。
        distances: 距離。
        wbgts: 推定 WBGT。
        h_mean: 心拍の平均。
        h_std: 心拍の標準偏差。
        d_mean: 距離の平均。
        d_std: 距離の標準偏差。
        w_mean: WBGT の平均。
        w_std: WBGT の標準偏差。

    Returns:
        定数以外で、列がほぼ一定ではない項。
    """
    usable: list[Term] = []
    for term in terms:
        column = []
        for heart, distance, wbgt in zip(heart_rates, distances, wbgts, strict=True):
            scaled = (
                (heart - h_mean) / h_std,
                (distance - d_mean) / d_std,
                (wbgt - w_mean) / w_std,
            )
            column.append(float(term.eval(*scaled)))
        if term.key == "1" or max(column) - min(column) > 1e-8:
            usable.append(term)
    return usable or [TERMS[0]]


def fit_pace_model(
    heart_rates: list[float],
    distances: list[float],
    wbgts: list[float],
    paces_sec: list[float],
    weights: list[float],
    uses_hr: bool,
) -> FittedPaceModel | None:
    """
    重み付き最小二乗でペースモデルを当てはめる。

    Args:
        heart_rates: 心拍。未使用でも長さは揃える。
        distances: 距離。
        wbgts: 推定 WBGT。
        paces_sec: 秒/km。
        weights: 直近重み。
        uses_hr: 心拍項を入れるか。

    Returns:
        当てはめたモデル。解けなければ None。
    """
    n = len(paces_sec)
    if n < 2 or sum(weights) <= 0:
        return None
    h_mean, h_std = _standardize(heart_rates, weights)
    d_mean, d_std = _standardize(distances, weights)
    w_mean, w_std = _standardize(wbgts, weights)
    y = [pace_kmh(value) for value in paces_sec]
    y_sec = paces_sec[:]

    terms = _usable_terms(choose_terms(n, uses_hr), heart_rates, distances, wbgts, h_mean, h_std, d_mean, d_std, w_mean, w_std)
    while terms:
        rows = []
        for heart, distance, wbgt in zip(heart_rates, distances, wbgts, strict=True):
            scaled = (
                (heart - h_mean) / h_std,
                (distance - d_mean) / d_std,
                (wbgt - w_mean) / w_std,
            )
            rows.append([float(term.eval(*scaled)) for term in terms])
        xtwx = [[0.0] * len(terms) for _ in terms]
        xtwy = [0.0] * len(terms)
        for row, target, weight in zip(rows, y, weights, strict=True):
            for i, left in enumerate(row):
                xtwy[i] += weight * left * target
                for j, right in enumerate(row):
                    xtwx[i][j] += weight * left * right
        coef = _solve(xtwx, xtwy)
        if coef is not None:
            fitted = FittedPaceModel(
                terms=terms,
                coefficients=coef,
                h_mean=h_mean,
                h_std=h_std,
                d_mean=d_mean,
                d_std=d_std,
                w_mean=w_mean,
                w_std=w_std,
                r2=0.0,
                rmse_sec_per_km=0.0,
                uses_hr=uses_hr,
            )
            preds_kmh = [
                fitted.predict_kmh(heart, distance, wbgt)
                for heart, distance, wbgt in zip(heart_rates, distances, wbgts, strict=True)
            ]
            preds_sec = [pace_sec_per_km(value) for value in preds_kmh]
            total_w = sum(weights)
            ybar = sum(weight * target for weight, target in zip(weights, y, strict=True)) / total_w
            ss_res = sum(
                weight * (target - pred) ** 2
                for weight, target, pred in zip(weights, y, preds_kmh, strict=True)
            )
            ss_tot = sum(weight * (target - ybar) ** 2 for weight, target in zip(weights, y, strict=True))
            fitted.r2 = 0.0 if ss_tot <= 1e-12 else max(0.0, min(1.0, 1.0 - ss_res / ss_tot))
            fitted.rmse_sec_per_km = math.sqrt(
                sum(
                    weight * (actual - pred) ** 2
                    for weight, actual, pred in zip(weights, y_sec, preds_sec, strict=True)
                )
                / total_w
            )
            return fitted
        if len(terms) == 1:
            return None
        terms = terms[:-1]
    return None
