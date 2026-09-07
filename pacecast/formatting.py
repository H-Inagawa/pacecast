"""時間・ペースの表示と入力変換。"""

from datetime import datetime


def duration_from_hms(hours: int, minutes: int, seconds: int) -> int:
    """
    時・分・秒から走行時間（秒）を作る。

    Args:
        hours: 時（0〜23）。
        minutes: 分（0〜59）。
        seconds: 秒（0〜59）。

    Returns:
        走行時間（秒）。

    Raises:
        ValueError: 範囲外、または合計が 0 以下のとき。
    """
    if hours < 0 or hours > 23:
        raise ValueError("時は 0〜23 で選択してください")
    if minutes < 0 or minutes > 59:
        raise ValueError("分は 0〜59 で選択してください")
    if seconds < 0 or seconds > 59:
        raise ValueError("秒は 0〜59 で選択してください")
    total = hours * 3600 + minutes * 60 + seconds
    if total <= 0:
        raise ValueError("走行時間は 1 秒以上にしてください")
    return total


def split_duration(seconds: int) -> tuple[int, int, int]:
    """
    秒を時・分・秒に分解する。

    Args:
        seconds: 走行時間（秒）。

    Returns:
        (時, 分, 秒)。
    """
    total = max(0, int(seconds))
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    return hours, minutes, secs


def parse_duration(text: str) -> int:
    """
    走行時間の文字列を秒に変換する。

    Args:
        text: `HH:MM:SS`、`MM:SS`、または秒数の文字列。

    Returns:
        走行時間（秒）。

    Raises:
        ValueError: 形式が不正、または 0 以下のとき。
    """
    raw = text.strip()
    if not raw:
        raise ValueError("走行時間を入力してください")

    if raw.isdigit():
        seconds = int(raw)
        if seconds <= 0:
            raise ValueError("走行時間は 1 秒以上にしてください")
        return seconds

    parts = raw.split(":")
    if len(parts) == 2:
        minutes, seconds = int(parts[0]), int(parts[1])
        total = minutes * 60 + seconds
    elif len(parts) == 3:
        hours, minutes, seconds = int(parts[0]), int(parts[1]), int(parts[2])
        total = hours * 3600 + minutes * 60 + seconds
    else:
        raise ValueError("走行時間は 1:23:45 または 23:45 の形式で入力してください")

    if total <= 0:
        raise ValueError("走行時間は 1 秒以上にしてください")
    return total


def format_duration(seconds: int | float) -> str:
    """
    秒を時:分:秒の文字列にする。

    Args:
        seconds: 秒数。

    Returns:
        `H:MM:SS` 形式の文字列。
    """
    total = int(round(seconds))
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}"


def format_pace(sec_per_km: float) -> str:
    """
    秒/km を分'秒" 表記にする。

    Args:
        sec_per_km: キロあたり秒数。

    Returns:
        例: `5'30"/km`
    """
    total = int(round(sec_per_km))
    minutes, secs = divmod(total, 60)
    return f"{minutes}'{secs:02d}\"/km"


def parse_datetime_local(text: str) -> datetime:
    """
    datetime-local 入力を datetime にする。

    Args:
        text: `YYYY-MM-DDTHH:MM` または秒付き。

    Returns:
        タイムゾーンなしの datetime。

    Raises:
        ValueError: 形式が不正なとき。
    """
    raw = text.strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    raise ValueError("日時の形式が正しくありません")


def to_datetime_local_value(value: datetime) -> str:
    """
    datetime を HTML の datetime-local 用文字列にする。

    Args:
        value: 変換する日時。

    Returns:
        `YYYY-MM-DDTHH:MM` 形式の文字列。
    """
    return value.strftime("%Y-%m-%dT%H:%M")
