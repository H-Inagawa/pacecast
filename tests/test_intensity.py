"""心拍ゾーンと年齢式のテスト。"""

from datetime import date

from pacecast.services.intensity import (
    age_from_birthday,
    classify_run_zone,
    hr_from_max,
    max_hr_from_age,
    suggested_intensity_hrs,
)


def test_age_from_birthday_truncates_to_full_years() -> None:
    """誕生日前は満年齢を1つ下げる。"""
    assert age_from_birthday(date(1990, 9, 10), date(2026, 9, 6)) == 35
    assert age_from_birthday(date(1990, 9, 6), date(2026, 9, 6)) == 36


def test_max_hr_from_age() -> None:
    """220 マイナス年齢で最大心拍を出す。"""
    assert max_hr_from_age(36) == 184


def test_suggested_intensity_hrs_uses_specified_ratios() -> None:
    """強度別は指定の百分率を四捨五入する。"""
    values = suggested_intensity_hrs(184)
    assert values["low"] == hr_from_max(184, 0.65)
    assert values["medium"] == hr_from_max(184, 0.75)
    assert values["high"] == hr_from_max(184, 0.85)
    assert values["race_5k"] == hr_from_max(184, 0.95)
    assert values["race_full"] == hr_from_max(184, 0.80)


def test_classify_run_zone_boundaries() -> None:
    """70%未満は低、80%以上は高、色分けオフや未設定は None。"""
    assert classify_run_zone(139, 200, True) == "low"
    assert classify_run_zone(140, 200, True) == "medium"
    assert classify_run_zone(160, 200, True) == "high"
    assert classify_run_zone(150, 184, False) is None
    assert classify_run_zone(150, None, True) is None
    assert classify_run_zone(None, 184, True) is None
