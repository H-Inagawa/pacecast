"""気象庁時別 CSV の取り込み。"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from io import StringIO
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pacecast.config import DEFAULT_LOCATION, DEFAULT_WEATHER_CSV
from pacecast.models import WeatherObservation

_DATETIME_FORMATS = (
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)
_MISSING_TOKENS = {"", "×", "x", "--", "///", "nan", "NaN"}


@dataclass(frozen=True)
class ParsedObservation:
    """CSV から読み取った 1 時間分の観測。"""

    observed_at: datetime
    location: str
    temperature_c: float
    humidity_pct: float
    temperature_quality: int | None
    humidity_quality: int | None


@dataclass(frozen=True)
class ImportResult:
    """取り込み結果の集計。"""

    inserted: int
    updated: int
    skipped: int
    location: str
    source_path: str


def _decode_csv_bytes(raw: bytes) -> str:
    """
    CSV バイト列を文字列にデコードする。

    Args:
        raw: ファイルの生バイト。

    Returns:
        デコードしたテキスト。

    Raises:
        ValueError: 対応する文字コードで読めないとき。
    """
    for encoding in ("cp932", "utf-8-sig", "utf-8"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("気象 CSV の文字コードを判定できませんでした")


def _parse_observed_at(text: str) -> datetime | None:
    """
    観測日時文字列を datetime にする。

    Args:
        text: CSV 先頭列の日時。

    Returns:
        パースできた datetime。できない場合は None。
    """
    value = text.strip()
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _parse_optional_int(text: str) -> int | None:
    """
    品質情報などの整数を読む。

    Args:
        text: セル文字列。

    Returns:
        整数。空や不正値なら None。
    """
    value = text.strip()
    if value in _MISSING_TOKENS:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _parse_required_float(text: str) -> float | None:
    """
    気温・湿度の数値を読む。

    Args:
        text: セル文字列。

    Returns:
        浮動小数。欠測なら None。
    """
    value = text.strip()
    if value in _MISSING_TOKENS:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _detect_location(rows: list[list[str]]) -> str:
    """
    ヘッダ付近から地点名を拾う。

    Args:
        rows: CSV の全行。

    Returns:
        地点名。見つからなければ既定の練馬。
    """
    for row in rows[:8]:
        if not row:
            continue
        first = row[0].strip()
        if first:
            continue
        for cell in row[1:]:
            name = cell.strip()
            if name and name not in {"品質情報", "均質番号"}:
                return name
    return DEFAULT_LOCATION


def parse_weather_csv(text: str, source_name: str = "csv") -> list[ParsedObservation]:
    """
    気象庁時別 CSV の本文を観測リストにする。

    Args:
        text: デコード済み CSV テキスト。
        source_name: 未使用（呼び出し側の識別用に残す）。

    Returns:
        欠測を除いた観測のリスト。
    """
    del source_name
    rows = list(csv.reader(StringIO(text)))
    location = _detect_location(rows)
    observations: list[ParsedObservation] = []

    for row in rows:
        if not row or not row[0].strip():
            continue
        observed_at = _parse_observed_at(row[0])
        if observed_at is None:
            continue

        temperature = _parse_required_float(row[1]) if len(row) > 1 else None
        humidity = _parse_required_float(row[4]) if len(row) > 4 else None
        if temperature is None or humidity is None:
            continue

        observations.append(
            ParsedObservation(
                observed_at=observed_at,
                location=location,
                temperature_c=temperature,
                humidity_pct=humidity,
                temperature_quality=_parse_optional_int(row[2]) if len(row) > 2 else None,
                humidity_quality=_parse_optional_int(row[5]) if len(row) > 5 else None,
            )
        )
    return observations


def import_weather_csv(
    db: Session,
    csv_path: Path | None = None,
    raw_bytes: bytes | None = None,
    source: str = "csv",
) -> ImportResult:
    """
    気象 CSV を読み、観測テーブルへ upsert する。

    Args:
        db: DB セッション。
        csv_path: 取り込むファイルパス。省略時は既定 CSV。
        raw_bytes: パスの代わりに使うバイト列。
        source: 保存する source 列の値。

    Returns:
        追加・更新・スキップ件数を含む結果。
    """
    path = csv_path or DEFAULT_WEATHER_CSV
    if raw_bytes is None:
        if not path.exists():
            raise FileNotFoundError(f"気象 CSV が見つかりません: {path}")
        raw_bytes = path.read_bytes()

    observations = parse_weather_csv(_decode_csv_bytes(raw_bytes), source_name=str(path))
    existing = {
        row.observed_at: row
        for row in db.scalars(select(WeatherObservation)).all()
    }

    now = datetime.now()
    inserted = 0
    updated = 0
    location = observations[0].location if observations else DEFAULT_LOCATION

    for item in observations:
        current = existing.get(item.observed_at)
        if current is None:
            row = WeatherObservation(
                observed_at=item.observed_at,
                location=item.location,
                temperature_c=item.temperature_c,
                humidity_pct=item.humidity_pct,
                temperature_quality=item.temperature_quality,
                humidity_quality=item.humidity_quality,
                source=source,
                imported_at=now,
            )
            db.add(row)
            existing[item.observed_at] = row
            inserted += 1
            continue

        current.location = item.location
        current.temperature_c = item.temperature_c
        current.humidity_pct = item.humidity_pct
        current.temperature_quality = item.temperature_quality
        current.humidity_quality = item.humidity_quality
        current.source = source
        current.imported_at = now
        updated += 1

    db.commit()
    return ImportResult(
        inserted=inserted,
        updated=updated,
        skipped=0,
        location=location,
        source_path=str(path),
    )


def weather_count(db: Session) -> int:
    """
    保存済みの気象観測件数を返す。

    Args:
        db: DB セッション。

    Returns:
        件数。
    """
    return db.scalar(select(func.count()).select_from(WeatherObservation)) or 0


def import_default_weather_if_empty(db: Session) -> ImportResult | None:
    """
    気象テーブルが空で既定 CSV があるときだけ取り込む。

    Args:
        db: DB セッション。

    Returns:
        取り込んだ場合は結果。対象が無ければ None。
    """
    if weather_count(db) > 0 or not DEFAULT_WEATHER_CSV.exists():
        return None
    return import_weather_csv(db, DEFAULT_WEATHER_CSV)
