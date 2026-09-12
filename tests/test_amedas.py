"""アメダス応答の解釈テスト。"""

from datetime import datetime

from pacecast.services.amedas import AmedasStation, parse_map_station, station_sort_key


def test_station_sort_key_orders_by_numeric_id() -> None:
    """観測所番号の小さい地点が先になる。"""
    nerima = AmedasStation("44071", "練馬", "", 35.7, 139.6)
    tokyo = AmedasStation("44132", "東京", "", 35.7, 139.8)
    soya = AmedasStation("11001", "Cape Soya", "", 45.5, 141.9)
    assert station_sort_key(soya) < station_sort_key(nerima) < station_sort_key(tokyo)


def test_parse_map_station_reads_temp_humidity_wind() -> None:
    """マップ JSON の気温・湿度・風速を読む。日射が無ければ None。"""
    row = parse_map_station(
        {
            "temp": [20.5, 0],
            "humidity": [96, 0],
            "wind": [1.4, 0],
            "sun10m": [0, 0],
        },
        "44071",
        datetime(2026, 9, 11, 7, 0),
    )
    assert row.station_id == "44071"
    assert row.temperature_c == 20.5
    assert row.humidity_pct == 96
    assert row.wind_ms == 1.4
    assert row.solar_wm2 is None


def test_parse_map_station_skips_missing_temp() -> None:
    """欠測の気温は None。"""
    row = parse_map_station({"temp": [None, 5], "humidity": [60, 0]}, "44071", datetime(2026, 9, 11, 7, 0))
    assert row.temperature_c is None
    assert row.humidity_pct == 60
