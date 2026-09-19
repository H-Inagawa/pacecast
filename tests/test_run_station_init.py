"""走行追加の初期地点設定。"""

from pacecast.services.profile import normalize_run_station_init


def test_normalize_run_station_init() -> None:
    """
    GPS 以外は設定地点にする。

    Args:
        なし。

    Returns:
        なし。
    """
    assert normalize_run_station_init("gps") == "gps"
    assert normalize_run_station_init("profile") == "profile"
    assert normalize_run_station_init(None) == "profile"
    assert normalize_run_station_init("unknown") == "profile"
