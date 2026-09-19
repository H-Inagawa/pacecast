"""気象関連付けのテスト。"""

from datetime import datetime

from pacecast.models import RunningRecord, WeatherObservation
from pacecast.services.matching import attach_weather, find_nearest_weather
from pacecast.services.wbgt import estimate_wbgt
from pacecast.services.weather_span import effective_weather, record_weather


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


def test_find_nearest_weather_prefers_same_station(db) -> None:
    """地点を指定したときは、その地点の観測だけを見る。"""
    nerima = WeatherObservation(
        observed_at=datetime(2025, 9, 5, 7, 0),
        location="練馬",
        temperature_c=20.0,
        humidity_pct=50.0,
        station_id="44071",
        source="test",
        imported_at=datetime(2026, 1, 1),
    )
    tokyo = WeatherObservation(
        observed_at=datetime(2025, 9, 5, 7, 0),
        location="東京",
        temperature_c=22.0,
        humidity_pct=55.0,
        station_id="44132",
        source="test",
        imported_at=datetime(2026, 1, 1),
    )
    db.add_all([nerima, tokyo])
    db.commit()
    found = find_nearest_weather(db, datetime(2025, 9, 5, 7, 5), station_id="44132")
    assert found is not None
    assert found.id == tokyo.id


def test_find_nearest_weather_returns_none_when_too_far(db) -> None:
    """許容差を超える観測は関連付けない。"""
    _add_weather(db, datetime(2025, 9, 5, 1, 0))
    found = find_nearest_weather(db, datetime(2025, 9, 5, 12, 0))
    assert found is None


def test_attach_weather_averages_start_and_end(db) -> None:
    """
    長時間走は開始と終了の1時間値を持ち、平均を表示に使う。

    Args:
        db: テスト用セッション。

    Returns:
        なし。
    """
    start = _add_weather(db, datetime(2025, 9, 5, 7, 0), temperature=20.0, humidity=40.0)
    end = _add_weather(db, datetime(2025, 9, 5, 9, 0), temperature=30.0, humidity=60.0)
    start.wind_ms = 2.0
    start.solar_wm2 = 400.0
    end.wind_ms = 2.0
    end.solar_wm2 = 400.0
    db.commit()
    record = RunningRecord(
        started_at=datetime(2025, 9, 5, 7, 10),
        distance_km=20.0,
        duration_sec=2 * 3600,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    attach_weather(db, record)
    assert record.weather_observation_id == start.id
    assert record.weather_end_observation_id == end.id
    weather = record_weather(record)
    assert weather is not None
    assert weather.temperature_c == 25.0
    assert weather.humidity_pct == 50.0
    assert weather.wbgt_c == estimate_wbgt(25.0, 50.0, 400.0, 2.0)


def test_attach_weather_keeps_one_hour_run_as_start_point(db) -> None:
    """
    1時間走は終了が次の正時でも開始の1点のまま。

    Args:
        db: テスト用セッション。

    Returns:
        なし。
    """
    morning = _add_weather(db, datetime(2025, 9, 5, 8, 0), temperature=20.0, humidity=40.0)
    _add_weather(db, datetime(2025, 9, 5, 9, 0), temperature=24.0, humidity=50.0)
    record = RunningRecord(
        started_at=datetime(2025, 9, 5, 8, 0),
        distance_km=8.0,
        duration_sec=3600,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    attach_weather(db, record)
    assert record.weather_observation_id == morning.id
    assert record.weather_end_observation_id is None
    weather = record_weather(record)
    assert weather is not None
    assert weather.temperature_c == 20.0


def test_attach_weather_keeps_one_point_for_short_run(db) -> None:
    """
    同じ1時間値に収まる短い走は開始の1点のまま。

    Args:
        db: テスト用セッション。

    Returns:
        なし。
    """
    hour = _add_weather(db, datetime(2025, 9, 5, 7, 0))
    record = RunningRecord(
        started_at=datetime(2025, 9, 5, 7, 5),
        distance_km=5.0,
        duration_sec=30 * 60,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    attach_weather(db, record)
    assert record.weather_observation_id == hour.id
    assert record.weather_end_observation_id is None
    weather = effective_weather(record.weather, record.weather_end)
    assert weather is not None
    assert weather.temperature_c == 20.0


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
