"""気象 CSV 取り込みのテスト。"""

from datetime import datetime

from pacecast.services.weather_import import import_weather_csv, parse_weather_csv, weather_count

SAMPLE_CSV = """ダウンロードした時刻：2026/09/06 18:20:50

,練馬,練馬,練馬,練馬,練馬,練馬
年月日時,気温(℃),気温(℃),気温(℃),相対湿度(％),相対湿度(％),相対湿度(％)
,,品質情報,均質番号,,品質情報,均質番号
2025/9/5 1:00:00,25.6,8,1,89,8,1
2025/9/5 2:00:00,25.5,8,1,91,8,1
2025/9/5 3:00:00,,8,1,95,8,1
"""


def test_parse_weather_csv_skips_headers_and_missing_temp() -> None:
    """ヘッダと欠測行を除き、地点と観測値を読む。"""
    rows = parse_weather_csv(SAMPLE_CSV)
    assert len(rows) == 2
    assert rows[0].location == "練馬"
    assert rows[0].observed_at == datetime(2025, 9, 5, 1, 0)
    assert rows[0].temperature_c == 25.6
    assert rows[0].humidity_pct == 89
    assert rows[0].temperature_quality == 8


def test_import_weather_csv_upserts(db, tmp_path) -> None:
    """同じ時刻は更新され、件数は増えない。"""
    path = tmp_path / "weather.csv"
    path.write_bytes(SAMPLE_CSV.encode("cp932"))

    first = import_weather_csv(db, path)
    assert first.inserted == 2
    assert weather_count(db) == 2

    second = import_weather_csv(db, path)
    assert second.inserted == 0
    assert second.updated == 2
    assert weather_count(db) == 2
