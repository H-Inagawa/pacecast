"""長時間走の開始・終了気象を平均する。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from pacecast.models import RunningRecord, WeatherObservation
from pacecast.services.wbgt import estimate_wbgt


SPAN_AVERAGE_MIN_DURATION_SEC = 60 * 60 + 1


def should_average_weather_span(duration_sec: int) -> bool:
    """
    開始と終了の2点平均を使う長さか。

    Args:
        duration_sec: 走行時間（秒）。

    Returns:
        1時間を超えるとき True。
    """
    return duration_sec >= SPAN_AVERAGE_MIN_DURATION_SEC


def run_ended_at(started_at: datetime, duration_sec: int) -> datetime:
    """
    走行終了時刻を返す。

    Args:
        started_at: 走行開始日時。
        duration_sec: 走行時間（秒）。

    Returns:
        開始に走行時間を足した日時。負の秒は 0 秒とみなす。
    """
    return started_at + timedelta(seconds=max(0, duration_sec))


def mean_numbers(values: list[float | None]) -> float | None:
    """
    欠損を除いた算術平均を返す。

    Args:
        values: 平均する値。

    Returns:
        平均。使える値が無ければ None。
    """
    nums = [value for value in values if value is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


@dataclass(frozen=True)
class EffectiveWeather:
    """表示・予測に使う走行時間帯の気象。"""

    temperature_c: float
    humidity_pct: float
    observed_at: datetime
    wbgt_c: float | None
    wind_ms: float | None = None
    solar_wm2: float | None = None


def effective_weather(
    start: WeatherObservation | None,
    end: WeatherObservation | None,
) -> EffectiveWeather | None:
    """
    開始と終了の観測から、走行時間帯の気象を返す。

    Args:
        start: 開始時刻の最近傍観測。
        end: 終了時刻の最近傍観測。同じ行や無しなら開始だけ使う。

    Returns:
        気温・湿度・風・日射を平均し、推定 WBGT を付け直した値。開始が無ければ None。
    """
    if start is None:
        return None
    if end is None or end.id == start.id:
        return EffectiveWeather(
            temperature_c=start.temperature_c,
            humidity_pct=start.humidity_pct,
            observed_at=start.observed_at,
            wbgt_c=start.wbgt_c,
            wind_ms=start.wind_ms,
            solar_wm2=start.solar_wm2,
        )
    if abs((end.observed_at - start.observed_at).total_seconds()) <= 3600:
        return EffectiveWeather(
            temperature_c=start.temperature_c,
            humidity_pct=start.humidity_pct,
            observed_at=start.observed_at,
            wbgt_c=start.wbgt_c,
            wind_ms=start.wind_ms,
            solar_wm2=start.solar_wm2,
        )
    temperature_c = mean_numbers([start.temperature_c, end.temperature_c])
    humidity_pct = mean_numbers([start.humidity_pct, end.humidity_pct])
    if temperature_c is None or humidity_pct is None:
        return EffectiveWeather(
            temperature_c=start.temperature_c,
            humidity_pct=start.humidity_pct,
            observed_at=start.observed_at,
            wbgt_c=start.wbgt_c,
            wind_ms=start.wind_ms,
            solar_wm2=start.solar_wm2,
        )
    wind_ms = mean_numbers([start.wind_ms, end.wind_ms])
    solar_wm2 = mean_numbers([start.solar_wm2, end.solar_wm2])
    wbgt_c = mean_numbers([start.wbgt_c, end.wbgt_c])
    if wind_ms is not None and solar_wm2 is not None:
        wbgt_c = estimate_wbgt(temperature_c, humidity_pct, solar_wm2, wind_ms)
    return EffectiveWeather(
        temperature_c=temperature_c,
        humidity_pct=humidity_pct,
        observed_at=start.observed_at,
        wbgt_c=wbgt_c,
        wind_ms=wind_ms,
        solar_wm2=solar_wm2,
    )


def record_weather(record: RunningRecord) -> EffectiveWeather | None:
    """
    走行に付いた開始・終了観測から時間帯の気象を返す。

    Args:
        record: 走行記録。

    Returns:
        時間帯の気象。開始観測が無ければ None。
    """
    return effective_weather(record.weather, getattr(record, "weather_end", None))
