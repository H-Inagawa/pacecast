"""気象庁アメダス地点マスタと、直近のマップ観測の取得。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from pacecast.config import (
    DATA_DIR,
    DEFAULT_AMEDAS_STATION_ID,
    DEFAULT_AMEDAS_STATION_NAME,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
)

STATION_TABLE_URL = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json"
MAP_URL = "https://www.jma.go.jp/bosai/amedas/data/map/{stamp}.json"
STATION_CACHE_PATH = DATA_DIR / "amedastable.json"

_PREFECTURE_BY_CODE = {
    "11": "北海道",
    "12": "北海道",
    "13": "北海道",
    "14": "北海道",
    "15": "北海道",
    "16": "北海道",
    "17": "北海道",
    "18": "北海道",
    "19": "北海道",
    "20": "北海道",
    "21": "北海道",
    "22": "北海道",
    "23": "北海道",
    "24": "北海道",
    "31": "青森県",
    "32": "秋田県",
    "33": "岩手県",
    "34": "宮城県",
    "35": "山形県",
    "36": "福島県",
    "40": "茨城県",
    "41": "栃木県",
    "42": "群馬県",
    "43": "埼玉県",
    "44": "東京都",
    "45": "千葉県",
    "46": "神奈川県",
    "48": "長野県",
    "49": "山梨県",
    "50": "静岡県",
    "51": "愛知県",
    "52": "岐阜県",
    "53": "三重県",
    "54": "新潟県",
    "55": "富山県",
    "56": "石川県",
    "57": "福井県",
    "60": "滋賀県",
    "61": "京都府",
    "62": "大阪府",
    "63": "兵庫県",
    "64": "奈良県",
    "65": "和歌山県",
    "66": "岡山県",
    "67": "広島県",
    "68": "島根県",
    "69": "鳥取県",
    "71": "徳島県",
    "72": "香川県",
    "73": "愛媛県",
    "74": "高知県",
    "81": "山口県",
    "82": "福岡県",
    "83": "大分県",
    "84": "長崎県",
    "85": "佐賀県",
    "86": "熊本県",
    "87": "宮崎県",
    "88": "鹿児島県",
    "91": "沖縄県",
    "92": "沖縄県",
    "93": "沖縄県",
    "94": "沖縄県",
}


def prefecture_from_station_id(station_id: str | None) -> str:
    """
    観測所番号の先頭2桁から都道府県を返す。

    気象庁「地域気象観測所一覧」の都府県・振興局表示番号に従う。
    北海道の振興局はまとめて北海道、沖縄の離島番号も沖縄県にする。

    Args:
        station_id: アメダス観測所 ID。

    Returns:
        都道府県名。不明なら空文字。
    """
    code = str(station_id or "").strip()[:2]
    return _PREFECTURE_BY_CODE.get(code, "")


class AmedasError(Exception):
    """アメダス取得に失敗したときの例外。"""


@dataclass(frozen=True)
class AmedasStation:
    """アメダス地点。"""

    station_id: str
    name: str
    elems: str
    latitude: float
    longitude: float
    prefecture: str = ""


@dataclass(frozen=True)
class AmedasObservation:
    """1地点・1時刻のアメダス値。"""

    observed_at: datetime
    station_id: str
    temperature_c: float | None
    humidity_pct: float | None
    wind_ms: float | None
    solar_wm2: float | None


def _dms_to_decimal(parts: list[float] | tuple[float, ...]) -> float:
    """
    度と分の配列を十進度にする。

    Args:
        parts: `[度, 分]`。

    Returns:
        十進度。
    """
    degrees = float(parts[0])
    minutes = float(parts[1]) if len(parts) > 1 else 0.0
    return degrees + minutes / 60.0


def _parse_station(station_id: str, payload: dict[str, Any]) -> AmedasStation | None:
    """
    地点マスタの1件を解釈する。

    Args:
        station_id: 観測所 ID。
        payload: マスタの1地点。

    Returns:
        地点。緯度経度が無ければ None。
    """
    lat = payload.get("lat")
    lon = payload.get("lon")
    name = str(payload.get("kjName") or "").strip()
    if not name or not isinstance(lat, list) or not isinstance(lon, list):
        return None
    return AmedasStation(
        station_id=str(station_id),
        name=name,
        elems=str(payload.get("elems") or ""),
        latitude=_dms_to_decimal(lat),
        longitude=_dms_to_decimal(lon),
        prefecture=prefecture_from_station_id(station_id),
    )


def _default_station() -> AmedasStation:
    """
    未設定時の既定地点（東京）を返す。

    Returns:
        東京（44132）。
    """
    return AmedasStation(
        station_id=DEFAULT_AMEDAS_STATION_ID,
        name=DEFAULT_AMEDAS_STATION_NAME,
        elems="",
        latitude=DEFAULT_LATITUDE,
        longitude=DEFAULT_LONGITUDE,
        prefecture=prefecture_from_station_id(DEFAULT_AMEDAS_STATION_ID),
    )


def station_sort_key(station: AmedasStation) -> tuple[int, str]:
    """
    観測所番号順（地方ごとの並び）にする。

    Args:
        station: 地点。

    Returns:
        比較用タプル。
    """
    try:
        return (int(station.station_id), station.station_id)
    except ValueError:
        return (10**9, station.station_id)


def load_station_table(force_refresh: bool = False) -> dict[str, Any]:
    """
    アメダス地点マスタを返す。取得済みならローカルキャッシュを使う。

    Args:
        force_refresh: True なら気象庁から再取得する。

    Returns:
        観測所 ID をキーにしたマスタ。

    Raises:
        AmedasError: 取得もキャッシュも使えないとき。
    """
    if not force_refresh and STATION_CACHE_PATH.exists():
        return json.loads(STATION_CACHE_PATH.read_text(encoding="utf-8"))

    try:
        response = httpx.get(STATION_TABLE_URL, timeout=20.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        if STATION_CACHE_PATH.exists():
            return json.loads(STATION_CACHE_PATH.read_text(encoding="utf-8"))
        raise AmedasError("アメダス地点マスタの取得に失敗しました") from exc

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATION_CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def list_stations() -> list[AmedasStation]:
    """
    設定のプルダウン用に地点一覧を返す。

    Returns:
        観測所番号順のリスト。取得失敗時は東京だけ。
    """
    try:
        table = load_station_table()
    except AmedasError:
        return [_default_station()]

    stations = []
    for station_id, payload in table.items():
        if not isinstance(payload, dict):
            continue
        station = _parse_station(str(station_id), payload)
        if station is not None:
            stations.append(station)
    stations.sort(key=station_sort_key)
    if not any(item.station_id == DEFAULT_AMEDAS_STATION_ID for item in stations):
        stations.insert(0, _default_station())
    return stations


def resolve_station(station_id: str | None) -> AmedasStation:
    """
    観測所 ID から地点を返す。不明・未指定なら東京。

    Args:
        station_id: 観測所 ID。

    Returns:
        該当地点。
    """
    wanted = (station_id or DEFAULT_AMEDAS_STATION_ID).strip() or DEFAULT_AMEDAS_STATION_ID
    for station in list_stations():
        if station.station_id == wanted:
            return station
    return _default_station()


def _amedas_number(entry: Any) -> float | None:
    """
    `[値, 品質]` 形式から数値を取る。

    Args:
        entry: アメダスの観測セル。

    Returns:
        数値。欠測なら None。
    """
    if not isinstance(entry, list) or not entry:
        return None
    value = entry[0]
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_map_station(payload: dict[str, Any], station_id: str, observed_at: datetime) -> AmedasObservation:
    """
    全国マップ JSON の1地点を観測にする。

    Args:
        payload: 1地点分の辞書。
        station_id: 観測所 ID。
        observed_at: マップの時刻。

    Returns:
        気温・湿度・風速などを入れた観測。日射は通常無いので None。
    """
    return AmedasObservation(
        observed_at=observed_at,
        station_id=station_id,
        temperature_c=_amedas_number(payload.get("temp")),
        humidity_pct=_amedas_number(payload.get("humidity")),
        wind_ms=_amedas_number(payload.get("wind")),
        solar_wm2=_amedas_number(payload.get("sun") or payload.get("radiation")),
    )


def _floor_10min(moment: datetime) -> datetime:
    """
    10分単位に切り捨てる。

    Args:
        moment: 対象時刻。

    Returns:
        秒を捨て、分を 0/10/20/30/40/50 にした時刻。
    """
    return moment.replace(minute=(moment.minute // 10) * 10, second=0, microsecond=0)


def fetch_map_observation(station_id: str, target_at: datetime) -> AmedasObservation | None:
    """
    直近に残っているアメダス全国マップから1地点を取る。

    気象庁の map JSON は数日分しか残らない。古い時刻は None。

    Args:
        station_id: 観測所 ID。
        target_at: 欲しい時刻。

    Returns:
        取れた観測。無ければ None。
    """
    stamp = _floor_10min(target_at).strftime("%Y%m%d%H%M00")
    url = MAP_URL.format(stamp=stamp)
    try:
        response = httpx.get(url, timeout=20.0)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError:
        return None
    station_payload = payload.get(station_id)
    if not isinstance(station_payload, dict):
        return None
    return parse_map_station(station_payload, station_id, _floor_10min(target_at))
