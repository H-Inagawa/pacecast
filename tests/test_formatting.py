"""時間・ペース変換のテスト。"""

from datetime import datetime

import pytest

from pacecast.formatting import (
    duration_from_hms,
    format_duration,
    format_pace,
    parse_datetime_local,
    parse_duration,
    split_duration,
)


def test_parse_duration_accepts_hms_and_ms() -> None:
    """時分秒と分秒の両方を秒に変換できる。"""
    assert parse_duration("1:23:45") == 5025
    assert parse_duration("23:45") == 1425
    assert parse_duration("90") == 90


def test_parse_duration_rejects_empty() -> None:
    """空文字はエラーになる。"""
    with pytest.raises(ValueError):
        parse_duration("  ")


def test_format_helpers() -> None:
    """表示用の書式が期待どおりである。"""
    assert format_duration(5025) == "1:23:45"
    assert format_pace(330) == "5'30\"/km"


def test_duration_from_hms_and_split() -> None:
    """時分秒の分解と組み立てが既存の秒表現と両立する。"""
    assert duration_from_hms(1, 25, 30) == 5130
    assert split_duration(5130) == (1, 25, 30)


def test_duration_from_hms_rejects_zero() -> None:
    """0秒はエラーになる。"""
    with pytest.raises(ValueError):
        duration_from_hms(0, 0, 0)


def test_parse_datetime_local_accepts_space_and_t() -> None:
    """画面形式と T 区切りの両方を datetime にできる。"""
    expected = datetime(2026, 9, 5, 21, 10)
    assert parse_datetime_local("2026-09-05 21:10") == expected
    assert parse_datetime_local("2026-09-05T21:10") == expected


def test_parse_datetime_local_rejects_invalid() -> None:
    """不正な文字列はエラーになる。"""
    with pytest.raises(ValueError):
        parse_datetime_local("2026/09/05 21:10")
