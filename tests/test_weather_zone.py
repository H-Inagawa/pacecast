"""推定 WBGT の色分けテスト。"""

from pacecast.services.weather_zone import classify_wbgt_zone


def test_wbgt_boundaries() -> None:
    """境界は下側を含み、未関連は none にする。"""
    assert classify_wbgt_zone(None) == "none"
    assert classify_wbgt_zone(9.9) == "too_cold"
    assert classify_wbgt_zone(10) == "cold"
    assert classify_wbgt_zone(14.9) == "cold"
    assert classify_wbgt_zone(15) == "comfort"
    assert classify_wbgt_zone(20.9) == "comfort"
    assert classify_wbgt_zone(21) == "hot"
    assert classify_wbgt_zone(27.9) == "hot"
    assert classify_wbgt_zone(28) == "too_hot"
