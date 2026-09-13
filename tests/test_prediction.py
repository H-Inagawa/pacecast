"""予測ロジックのテスト。"""

from datetime import datetime, timedelta

from sqlalchemy import select

from pacecast.models import RunningRecord, WeatherObservation
from pacecast.services.prediction import predict_performance, weather_distance

AS_OF = datetime(2026, 9, 13, 12, 0)


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


def _seed_linear_wbgt(db, count: int = 8) -> None:
    """
    WBGT が上がると遅くなる一群を入れる。

    Args:
        db: セッション。
        count: 件数。

    Returns:
        なし。
    """
    for index in range(count):
        started = datetime(2026, 8, 1, 7, 0) + timedelta(days=index)
        wbgt = 16.0 + index
        pace_sec = 300 + 6 * index
        _seed_run(db, started, wbgt, 60.0, int(pace_sec * 5), 150, 5.0)


def test_weather_distance_is_wbgt_abs() -> None:
    """気象距離は推定 WBGT の絶対差。"""
    assert weather_distance(20.0, 21.0) == 1
    assert weather_distance(24.5, 22.0) == 2.5


def test_predict_performance_uses_formula_for_wbgt(db) -> None:
    """涼しい条件の予測は、暑い条件より速くなる。"""
    _seed_linear_wbgt(db)
    cool = predict_performance(db, 16.0, 5.0, target_hr=150, as_of=AS_OF)
    hot = predict_performance(db, 23.0, 5.0, target_hr=150, as_of=AS_OF)
    assert cool is not None
    assert hot is not None
    assert cool.predicted_pace_sec_per_km < hot.predicted_pace_sec_per_km
    assert cool.predicted_duration_sec == round(cool.predicted_pace_sec_per_km * 5)
    assert cool.r_squared > 0.8
    assert cool.rmse_sec_per_km > 0
    assert cool.relation_charts[0].key == "wbgt"
    assert cool.relation_charts[0].curve
    assert cool.confidence in {"high", "medium", "low"}


def test_predict_performance_uses_heart_rate(db) -> None:
    """同じ気象でも、目標心拍が高いと予測ペースは速くなる。"""
    for index in range(8):
        started = datetime(2026, 8, 1, 7, 0) + timedelta(days=index)
        heart = 120 + 8 * index
        pace_sec = 400 - 8 * index
        _seed_run(db, started, 20.0, 60.0, int(pace_sec * 5), heart, 5.0)

    easy = predict_performance(db, 20.0, 5.0, "low", "低強度", 125, as_of=AS_OF)
    race = predict_performance(db, 20.0, 5.0, "race_5k", "5km", 175, as_of=AS_OF)
    assert easy is not None
    assert race is not None
    assert easy.uses_hr is True
    assert race.predicted_pace_sec_per_km < easy.predicted_pace_sec_per_km
    assert race.predicted_heart_rate == 175


def test_predict_performance_weights_recent_runs(db) -> None:
    """直近の走のほうが、同じ件数でも強く効く。"""
    _seed_run(db, datetime(2025, 1, 1, 7, 0), 20.0, 60.0, 1500, 150)
    _seed_run(db, datetime(2026, 9, 10, 7, 0), 20.0, 60.0, 1800, 150)
    result = predict_performance(db, 20.0, 5.0, target_hr=150, as_of=AS_OF)
    assert result is not None
    assert result.sample_count == 2
    assert result.predicted_pace_sec_per_km > 330


def test_predict_performance_returns_none_without_runs(db) -> None:
    """過去走が無いときは予測しない。"""
    assert predict_performance(db, 20.0, 5.0) is None


def test_used_runs_wbgt_delta_is_signed(db) -> None:
    """根拠走の差は、過去走の WBGT から予測対象を引いた符号付き。"""
    _seed_run(db, datetime(2025, 9, 5, 7, 0), 20.0, 60.0, 1500, 140)
    _seed_run(db, datetime(2025, 9, 6, 7, 0), 22.0, 60.0, 1500, 140)
    result = predict_performance(db, 21.0, 5.0, as_of=AS_OF)
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
