"""走行強度と心拍ゾーンの算出。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

# 心拍が無い過去走に足す距離。10 bpm = 1 なので、約 30 bpm 相当の遠さ。
MISSING_HR_PENALTY = 3.0
HR_DISTANCE_PER_BPM = 10.0

INTENSITY_RATIOS: dict[str, float] = {
    "low": 0.65,
    "medium": 0.75,
    "high": 0.85,
    "race_5k": 0.95,
    "race_10k": 0.92,
    "race_half": 0.88,
    "race_full": 0.80,
}

RACE_DISTANCES_KM: dict[str, float] = {
    "race_5k": 5.0,
    "race_10k": 10.0,
    "race_half": 21.0975,
    "race_full": 42.195,
}

INTENSITY_LABELS: dict[str, str] = {
    "low": "低強度（60〜70%）",
    "medium": "中強度（70〜80%）",
    "high": "高強度（80〜90%）",
    "race_5k": "5km（90〜100%）",
    "race_10k": "10km（90〜95%）",
    "race_half": "ハーフマラソン（85〜92%）",
    "race_full": "フルマラソン（75〜88%）",
}

PROFILE_HR_FIELDS: dict[str, str] = {
    "low": "hr_low",
    "medium": "hr_medium",
    "high": "hr_high",
    "race_5k": "hr_race_5k",
    "race_10k": "hr_race_10k",
    "race_half": "hr_race_half",
    "race_full": "hr_race_full",
}


@dataclass(frozen=True)
class IntensityPreset:
    """1つの走行強度。"""

    key: str
    label: str
    target_hr: int | None
    distance_km: float | None = None


def age_from_birthday(birthday: date, today: date | None = None) -> int:
    """
    誕生日から満年齢を返す。

    Args:
        birthday: 誕生日。
        today: 基準日。省略時は本日。

    Returns:
        満年齢（年未満切り捨て）。
    """
    current = today or date.today()
    years = current.year - birthday.year
    if (current.month, current.day) < (birthday.month, birthday.day):
        years -= 1
    return max(years, 0)


def max_hr_from_age(age: int) -> int:
    """
    年齢から最大心拍数を返す。

    Args:
        age: 満年齢。

    Returns:
        `220 - 年齢` を 80〜220 に収めた値。
    """
    return min(220, max(80, 220 - age))


def hr_from_max(max_heart_rate: int, ratio: float) -> int:
    """
    最大心拍と割合から目標心拍を四捨五入する。

    Args:
        max_heart_rate: 最大心拍数。
        ratio: 0〜1 の割合。

    Returns:
        四捨五入した bpm。
    """
    return int(round(max_heart_rate * ratio))


def suggested_intensity_hrs(max_heart_rate: int) -> dict[str, int]:
    """
    最大心拍から強度別の提案値を返す。

    Args:
        max_heart_rate: 最大心拍数。

    Returns:
        強度キーと bpm の対応。
    """
    return {key: hr_from_max(max_heart_rate, ratio) for key, ratio in INTENSITY_RATIOS.items()}


def classify_run_zone(
    avg_heart_rate: int | None,
    max_heart_rate: int | None,
    color_enabled: bool,
) -> str | None:
    """
    記録行の色分けゾーンを返す。

    Args:
        avg_heart_rate: その走の平均心拍。
        max_heart_rate: 設定の最大心拍。
        color_enabled: 色分け設定が有効か。

    Returns:
        `low` / `medium` / `high`。色分けしない場合は None。
    """
    if not color_enabled or max_heart_rate is None or max_heart_rate <= 0 or avg_heart_rate is None:
        return None
    ratio = avg_heart_rate / max_heart_rate
    if ratio < 0.70:
        return "low"
    if ratio < 0.80:
        return "medium"
    return "high"


def list_custom_intensities(target_hrs: dict[str, int | None]) -> list[IntensityPreset]:
    """
    距離入力用の低・中・高強度を返す。

    Args:
        target_hrs: 強度キーと保存済み心拍。

    Returns:
        予測画面用の強度一覧。
    """
    return [
        IntensityPreset(key=key, label=INTENSITY_LABELS[key], target_hr=target_hrs.get(key))
        for key in ("low", "medium", "high")
    ]


def race_options(target_hrs: dict[str, int | None]) -> list[IntensityPreset]:
    """
    レース種目の距離と目標心拍を返す。

    Args:
        target_hrs: 強度キーと保存済み心拍。

    Returns:
        レース選択肢。
    """
    return [
        IntensityPreset(
            key=key,
            label=INTENSITY_LABELS[key],
            target_hr=target_hrs.get(key),
            distance_km=RACE_DISTANCES_KM[key],
        )
        for key in ("race_5k", "race_10k", "race_half", "race_full")
    ]


def heart_rate_distance(actual_hr: int, target_hr: int) -> float:
    """
    記録心拍と目標心拍の距離を返す。

    Args:
        actual_hr: 過去走の平均心拍。
        target_hr: 指定した強度の目標心拍。

    Returns:
        10 bpm を距離 1 とした値。
    """
    return abs(actual_hr - target_hr) / HR_DISTANCE_PER_BPM
