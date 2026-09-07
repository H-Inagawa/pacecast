"""単一ユーザーのプロフィール読み書き。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from pacecast.models import UserProfile
from pacecast.services.intensity import (
    PROFILE_HR_FIELDS,
    age_from_birthday,
    classify_run_zone,
    suggested_intensity_hrs,
)


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
        profile = UserProfile(id=1, color_rows=True, updated_at=datetime.now())
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


def effective_color_rows(profile: UserProfile) -> bool:
    """
    実際に行を色分けするか。

    Args:
        profile: プロフィール。

    Returns:
        最大心拍があり、設定がオンのとき True。
    """
    return bool(profile.color_rows and profile.max_heart_rate)


def run_zone(profile: UserProfile, avg_heart_rate: int | None) -> str | None:
    """
    1件の走行の色分けゾーンを返す。

    Args:
        profile: プロフィール。
        avg_heart_rate: 平均心拍。

    Returns:
        ゾーン。色分けしない場合は None。
    """
    return classify_run_zone(avg_heart_rate, profile.max_heart_rate, effective_color_rows(profile))


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
    if profile.max_heart_rate is None:
        profile.color_rows = False
    profile.updated_at = datetime.now()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
