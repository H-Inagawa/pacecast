"""単一ユーザーのプロフィール読み書き。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from pacecast.config import DEFAULT_AMEDAS_STATION_ID, DEFAULT_AMEDAS_STATION_NAME
from pacecast.models import UserProfile
from pacecast.services.intensity import (
    PROFILE_HR_FIELDS,
    age_from_birthday,
    classify_run_zone,
    suggested_intensity_hrs,
)
from pacecast.services.weather_zone import classify_wbgt_zone

ROW_COLOR_MODES = ("hr", "wbgt", "off")


def get_or_create_profile(db: Session) -> UserProfile:
    """
    プロフィール行を返す。無ければ空の 1 行を作る。

    Args:
        db: DB セッション。

    Returns:
        id=1 のプロフィール。
    """
    profile = db.get(UserProfile, 1)
    if profile is None:
        profile = UserProfile(
            id=1,
            color_rows=True,
            row_color_mode="hr",
            amedas_station_id=DEFAULT_AMEDAS_STATION_ID,
            amedas_station_name=DEFAULT_AMEDAS_STATION_NAME,
            updated_at=datetime.now(),
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    if not profile.amedas_station_id:
        profile.amedas_station_id = DEFAULT_AMEDAS_STATION_ID
        profile.amedas_station_name = profile.amedas_station_name or DEFAULT_AMEDAS_STATION_NAME
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def profile_target_hrs(profile: UserProfile) -> dict[str, int | None]:
    """
    保存済みの強度別心拍を辞書にする。

    Args:
        profile: プロフィール。

    Returns:
        強度キーと bpm。
    """
    return {key: getattr(profile, field) for key, field in PROFILE_HR_FIELDS.items()}


def apply_suggested_hrs(profile: UserProfile, max_heart_rate: int) -> None:
    """
    最大心拍から強度別心拍を上書きする。

    Args:
        profile: 更新対象。
        max_heart_rate: 最大心拍数。

    Returns:
        なし。
    """
    suggested = suggested_intensity_hrs(max_heart_rate)
    for key, field in PROFILE_HR_FIELDS.items():
        setattr(profile, field, suggested[key])


def normalize_row_color_mode(mode: str | None, color_rows: bool | None = None) -> str:
    """
    行の色分け方式を正規化する。

    Args:
        mode: `hr` / `wbgt` / `off`。
        color_rows: 旧設定。mode が空のとき使う。

    Returns:
        正規化した方式。
    """
    if mode in ROW_COLOR_MODES:
        return mode
    return "hr" if color_rows else "off"


def effective_row_color_mode(profile: UserProfile) -> str:
    """
    実際に使う色分け方式を返す。

    Args:
        profile: プロフィール。

    Returns:
        `hr` / `wbgt` / `off`。心拍色分けは最大心拍が無いとオフ。
    """
    mode = normalize_row_color_mode(getattr(profile, "row_color_mode", None), profile.color_rows)
    if mode == "hr" and not profile.max_heart_rate:
        return "off"
    return mode


def effective_color_rows(profile: UserProfile) -> bool:
    """
    心拍ゾーンで行を色分けするか。

    Args:
        profile: プロフィール。

    Returns:
        方式が心拍で、最大心拍があるとき True。
    """
    return effective_row_color_mode(profile) == "hr"


def run_zone(profile: UserProfile, avg_heart_rate: int | None) -> str | None:
    """
    1件の走行の心拍色分けゾーンを返す。

    Args:
        profile: プロフィール。
        avg_heart_rate: 平均心拍。

    Returns:
        ゾーン。心拍色分けしない場合は None。
    """
    return classify_run_zone(avg_heart_rate, profile.max_heart_rate, effective_color_rows(profile))


def run_weather_zone(profile: UserProfile, wbgt_c: float | None, has_weather: bool) -> str | None:
    """
    1件の走行の気象色分けゾーンを返す。

    Args:
        profile: プロフィール。
        wbgt_c: 推定 WBGT。
        has_weather: 気象が付いているか。

    Returns:
        ゾーン。気象色分けしない場合は None。未関連や WBGT 無しは `none`。
    """
    if effective_row_color_mode(profile) != "wbgt":
        return None
    if not has_weather or wbgt_c is None:
        return "none"
    return classify_wbgt_zone(wbgt_c)


def resolve_target_hr(profile: UserProfile, intensity_key: str) -> int | None:
    """
    予測に使う目標心拍を返す。

    Args:
        profile: プロフィール。
        intensity_key: 強度キー。

    Returns:
        保存値。無ければ最大心拍からの提案値。どちらも無ければ None。
    """
    stored = profile_target_hrs(profile).get(intensity_key)
    if stored is not None:
        return stored
    if profile.max_heart_rate:
        return suggested_intensity_hrs(profile.max_heart_rate).get(intensity_key)
    return None


def profile_age(profile: UserProfile, today: date | None = None) -> int | None:
    """
    プロフィールの満年齢を返す。

    Args:
        profile: プロフィール。
        today: 基準日。

    Returns:
        満年齢。誕生日が無ければ None。
    """
    if profile.birthday is None:
        return None
    return age_from_birthday(profile.birthday, today)


def save_profile(db: Session, profile: UserProfile) -> UserProfile:
    """
    プロフィールを保存する。

    Args:
        db: DB セッション。
        profile: 更新済みの行。

    Returns:
        保存後のプロフィール。
    """
    mode = normalize_row_color_mode(getattr(profile, "row_color_mode", None), profile.color_rows)
    if profile.max_heart_rate is None and mode == "hr":
        mode = "off"
    profile.row_color_mode = mode
    profile.color_rows = mode == "hr"
    profile.updated_at = datetime.now()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
