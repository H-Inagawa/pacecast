"""推定 WBGT の計算テスト。"""

from pacecast.services.wbgt import estimate_wbgt, fallback_solar_wm2


def test_estimate_wbgt_ono2014() -> None:
    """小野・登内 (2014) の式どおりに計算する。"""
    expected = (
        0.735 * 28
        + 0.0374 * 70
        + 0.00292 * 28 * 70
        + 7.619 * 0.5
        - 4.557 * 0.5**2
        - 0.0572 * 2
        - 4.064
    )
    assert estimate_wbgt(28.0, 70.0, 500.0, 2.0) == expected


def test_fallback_solar_is_zero_at_night() -> None:
    """夜間の日射仮定は 0。"""
    assert fallback_solar_wm2(21) == 0.0
    assert fallback_solar_wm2(7) == 400.0
