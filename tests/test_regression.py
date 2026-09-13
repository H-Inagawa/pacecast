"""重み付き最小二乗の単体テスト。"""

from datetime import datetime, timedelta

from pacecast.services.regression import (
    choose_terms,
    fit_pace_model,
    pace_kmh,
    pace_sec_per_km,
    recency_weight,
)


def test_pace_roundtrip() -> None:
    """秒/km と km/h を行き来できる。"""
    assert pace_kmh(360) == 10
    assert pace_sec_per_km(12) == 300


def test_recency_weight_prefers_recent() -> None:
    """新しい走のほうが重い。"""
    as_of = datetime(2026, 9, 13, 12, 0)
    recent = recency_weight(as_of - timedelta(days=7), as_of)
    older = recency_weight(as_of - timedelta(days=30), as_of)
    assert recent > older
    assert 0.94 < recent < 0.96
    assert 0.79 < older < 0.81


def test_choose_terms_grows_with_sample_count() -> None:
    """件数が多いほど交差・2次まで入る。"""
    few = [term.key for term in choose_terms(4, uses_hr=True)]
    many = [term.key for term in choose_terms(20, uses_hr=True)]
    no_hr = [term.key for term in choose_terms(20, uses_hr=False)]
    assert few == ["1", "W"]
    assert "H" in many
    assert "WH" in many
    assert "H2" in many
    assert "H" not in no_hr
    assert "WH" not in no_hr


def test_fit_recovers_cooler_is_faster() -> None:
    """WBGT が高いほど遅いデータでは、涼しい条件の予測が速い。"""
    wbgts = [16.0 + index for index in range(8)]
    paces = [300.0 + 6.0 * index for index in range(8)]
    model = fit_pace_model(
        heart_rates=[150.0] * 8,
        distances=[5.0] * 8,
        wbgts=wbgts,
        paces_sec=paces,
        weights=[1.0] * 8,
        uses_hr=True,
    )
    assert model is not None
    cool = pace_sec_per_km(model.predict_kmh(150.0, 5.0, 16.0))
    hot = pace_sec_per_km(model.predict_kmh(150.0, 5.0, 23.0))
    assert cool < hot
    assert model.r2 > 0.9


def test_fit_keeps_heart_rate_when_weather_is_constant() -> None:
    """WBGT と距離が同じでも、心拍の項は残る。"""
    hearts = [120.0 + 8.0 * index for index in range(8)]
    paces = [400.0 - 8.0 * index for index in range(8)]
    model = fit_pace_model(
        heart_rates=hearts,
        distances=[5.0] * 8,
        wbgts=[20.0] * 8,
        paces_sec=paces,
        weights=[1.0] * 8,
        uses_hr=True,
    )
    assert model is not None
    assert any(term.key == "H" for term in model.terms)
    easy = pace_sec_per_km(model.predict_kmh(125.0, 5.0, 20.0))
    hard = pace_sec_per_km(model.predict_kmh(175.0, 5.0, 20.0))
    assert hard < easy
