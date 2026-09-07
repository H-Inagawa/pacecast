"""気象関連付けのテスト。"""

from datetime import datetime

from pacecast.models import RunningRecord, WeatherObservation
from pacecast.services.matching import find_nearest_weather


def _add_weather(db, observed_at: datetime, temperature: float = 20.0, humidity: float = 50.0) -> WeatherObservation:
    """
    テスト用の気象行を追加する。

    Args:
        db: セッション。
        observed_at: 観測時刻。
        temperature: 気温。
        humidity: 湿度。

    Returns:
        保存した観測。
    """
    row = WeatherObservation(
        observed_at=observed_at,
        location="練馬",
        temperature_c=temperature,
        humidity_pct=humidity,
        source="test",
        imported_at=datetime(2026, 1, 1),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_find_nearest_weather_prefers_closer_hour(db) -> None:
    """開始時刻により近い1時間値を選ぶ。"""
    earlier = _add_weather(db, datetime(2025, 9, 5, 7, 0))
    later = _add_weather(db, datetime(2025, 9, 5, 8, 0))
    found = find_nearest_weather(db, datetime(2025, 9, 5, 7, 50))
    assert found is not None
    assert found.id == later.id
    assert found.id != earlier.id


def test_find_nearest_weather_breaks_tie_with_earlier(db) -> None:
    """時間差が同じなら早い観測を選ぶ。"""
    earlier = _add_weather(db, datetime(2025, 9, 5, 7, 0))
    _add_weather(db, datetime(2025, 9, 5, 8, 0))
    found = find_nearest_weather(db, datetime(2025, 9, 5, 7, 30))
    assert found is not None
    assert found.id == earlier.id


def test_find_nearest_weather_returns_none_when_too_far(db) -> None:
    """許容差を超える観測は関連付けない。"""
    _add_weather(db, datetime(2025, 9, 5, 1, 0))
    found = find_nearest_weather(db, datetime(2025, 9, 5, 12, 0))
    assert found is None


def test_running_record_pace(db) -> None:
    """距離と時間からペースを計算できる。"""
    record = RunningRecord(
        started_at=datetime(2025, 9, 5, 7, 0),
        distance_km=5.0,
        duration_sec=1500,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    assert record.pace_sec_per_km == 300
