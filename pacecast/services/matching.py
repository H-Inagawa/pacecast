"""走行記録と気象観測の関連付け。"""

from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from pacecast.config import MATCH_MAX_DELTA_MINUTES, SAMPLE_AMEDAS_STATION_ID
from pacecast.models import RunningRecord, WeatherObservation


def find_nearest_weather(
    db: Session,
    started_at: datetime,
    max_delta_minutes: int = MATCH_MAX_DELTA_MINUTES,
    station_id: str | None = None,
) -> WeatherObservation | None:
    """
    走行開始時刻に最も近い気象観測を探す。

    Args:
        db: DB セッション。
        started_at: 走行開始日時。
        max_delta_minutes: 許容する最大時間差（分）。
        station_id: アメダス地点。指定時はその地点（練馬なら地点空の旧行も含む）。

    Returns:
        条件に合う観測。無ければ None。同距離なら早い時刻を返す。
    """
    window = timedelta(minutes=max_delta_minutes)
    query = (
        select(WeatherObservation)
        .where(WeatherObservation.observed_at >= started_at - window)
        .where(WeatherObservation.observed_at <= started_at + window)
    )
    if station_id:
        if station_id == SAMPLE_AMEDAS_STATION_ID:
            query = query.where(
                or_(
                    WeatherObservation.station_id == station_id,
                    WeatherObservation.station_id.is_(None),
                )
            )
        else:
            query = query.where(WeatherObservation.station_id == station_id)
    candidates = db.scalars(query.order_by(WeatherObservation.observed_at.asc())).all()

    if not candidates:
        return None

    def sort_key(row: WeatherObservation) -> tuple[float, datetime]:
        """
        近さ優先、同時刻差なら早い観測を先にする。

        Args:
            row: 気象観測。

        Returns:
            比較用タプル。
        """
        delta = abs((row.observed_at - started_at).total_seconds())
        return (delta, row.observed_at)

    return min(candidates, key=sort_key)


def attach_weather(db: Session, record: RunningRecord) -> RunningRecord:
    """
    1件の走行記録に最近傍の気象を付ける。

    Args:
        db: DB セッション。
        record: 対象の走行記録。

    Returns:
        気象 ID を更新した走行記録。
    """
    weather = find_nearest_weather(db, record.started_at, station_id=record.amedas_station_id)
    record.weather_observation_id = weather.id if weather else None
    return record


def relink_all_runs(db: Session) -> int:
    """
    すべての走行記録の気象関連付けをやり直す。

    Args:
        db: DB セッション。

    Returns:
        気象が付いた記録の件数。
    """
    linked = 0
    records = db.scalars(select(RunningRecord)).all()
    for record in records:
        attach_weather(db, record)
        if record.weather_observation_id is not None:
            linked += 1
    db.commit()
    return linked
