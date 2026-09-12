"""予測ロジックのテスト。"""

from datetime import datetime

from sqlalchemy import select

from pacecast.models import RunningRecord, WeatherObservation
from pacecast.services.prediction import predict_performance, weather_distance


def _seed_run(
    db,
    started_at: datetime,
    temperature: float,
    humidity: float,
    duration_sec: int,
    heart_rate: int | None = 150,
    distance_km: float = 5.0,
) -> None:
    """
    気象付きの走行記録を1件入れる。

    Args:
        db: セッション。
        started_at: 走行開始。
        temperature: 気温。
        humidity: 湿度。
        duration_sec: 走行時間。
        heart_rate: 平均心拍。
        distance_km: 距離。

    Returns:
        なし。
    """
    weather = WeatherObservation(
        observed_at=started_at,
        location="練馬",
        temperature_c=temperature,
        humidity_pct=humidity,
        wind_ms=2.0,
        solar_wm2=300.0,
        wbgt_c=temperature,
        wbgt_method="ono2014",
        source="test",
        imported_at=datetime(2026, 1, 1),
    )
    db.add(weather)
    db.flush()
    db.add(
        RunningRecord(
            started_at=started_at,
            distance_km=distance_km,
            duration_sec=duration_sec,
            avg_heart_rate=heart_rate,
            weather_observation_id=weather.id,
            created_at=datetime(2026, 1, 1),
            updated_at=datetime(2026, 1, 1),
        )
    )
    db.commit()


def test_weather_distance_is_wbgt_abs() -> None:
    """気象距離は推定 WBGT の絶対差。"""
    assert weather_distance(20.0, 21.0) == 1
    assert weather_distance(24.5, 22.0) == 2.5


def test_predict_performance_weights_similar_weather(db) -> None:
    """近い WBGT の走が、遠い走より強く効く。"""
    _seed_run(db, datetime(2025, 9, 5, 7, 0), 20.0, 60.0, 1500, 140)
    _seed_run(db, datetime(2025, 9, 6, 7, 0), 30.0, 80.0, 1800, 165)

    result = predict_performance(db, 20.0, 10.0, target_hr=145, intensity_label="中強度")
    assert result is not None
    assert result.sample_count == 2
    assert result.near_count == 1
    assert result.predicted_pace_sec_per_km < 330
    assert result.predicted_duration_sec == round(result.predicted_pace_sec_per_km * 10)
    assert result.predicted_heart_rate == 145
    assert result.intensity_label == "中強度"


def test_predict_performance_returns_none_without_runs(db) -> None:
    """過去走が無いときは予測しない。"""
    assert predict_performance(db, 20.0, 5.0) is None


def test_used_runs_wbgt_delta_is_signed(db) -> None:
    """根拠走の差は、過去走の WBGT から予測対象を引いた符号付き。"""
    _seed_run(db, datetime(2025, 9, 5, 7, 0), 20.0, 60.0, 1500, 140)
    _seed_run(db, datetime(2025, 9, 6, 7, 0), 22.0, 60.0, 1500, 140)
    result = predict_performance(db, 21.0, 5.0)
    assert result is not None
    deltas = {round(item.wbgt_c, 1): item.wbgt_delta for item in result.used_runs}
    assert deltas[20.0] == -1.0
    assert deltas[22.0] == 1.0


def test_predict_performance_skips_runs_without_wbgt(db) -> None:
    """WBGT が無い走は予測に使わない。"""
    _seed_run(db, datetime(2025, 9, 5, 7, 0), 20.0, 60.0, 1500, 140)
    row = db.scalars(select(WeatherObservation)).one()
    row.wbgt_c = None
    db.commit()
    assert predict_performance(db, 20.0, 5.0) is None


def test_predict_performance_prefers_matching_intensity(db) -> None:
    """同じ気象でも、指定強度に近い心拍の走がペースに強く効く。"""
    _seed_run(db, datetime(2025, 9, 5, 7, 0), 20.0, 60.0, 1800, 125)
    _seed_run(db, datetime(2025, 9, 6, 7, 0), 20.0, 60.0, 1500, 175)

    easy = predict_performance(db, 20.0, 5.0, "low", "低強度", 125)
    race = predict_performance(db, 20.0, 5.0, "race_5k", "5km", 175)
    assert easy is not None
    assert race is not None
    assert easy.predicted_heart_rate == 125
    assert race.predicted_heart_rate == 175
    assert race.predicted_pace_sec_per_km < easy.predicted_pace_sec_per_km
