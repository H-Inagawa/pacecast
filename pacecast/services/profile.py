"""ランナーごとのプロフィール読み書き。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pacecast.config import DEFAULT_AMEDAS_STATION_ID, DEFAULT_AMEDAS_STATION_NAME
from pacecast.models import AuthUser, RunningRecord, UserProfile
from pacecast.services.intensity import (
    PROFILE_HR_FIELDS,
    age_from_birthday,
    classify_run_zone,
    suggested_intensity_hrs,
)
from pacecast.services.weather_zone import classify_wbgt_zone

ROW_COLOR_MODES = ("hr", "wbgt", "off")
SHARED_LEGACY_EMAILS = ("dev@pacecast.local", "hinagawa1417@gmail.com")


def get_or_create_profile(db: Session, user: AuthUser) -> UserProfile:
    """
    ログイン中ユーザーのプロフィールを返す。無ければ空の 1 行を作る。

    Args:
        db: DB セッション。
        user: ログイン中のユーザー。

    Returns:
        そのユーザーのプロフィール。
    """
    profile = db.scalar(select(UserProfile).where(UserProfile.auth_user_id == user.id))
    if profile is None:
        profile = UserProfile(
            auth_user_id=user.id,
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


def _clone_profile(source: UserProfile, auth_user_id: int) -> UserProfile:
    """
    設定を別ユーザー向けに複製する。

    Args:
        source: コピー元。
        auth_user_id: コピー先のユーザー ID。

    Returns:
        未保存の複製。
    """
    return UserProfile(
        auth_user_id=auth_user_id,
        display_name=source.display_name,
        birthday=source.birthday,
        max_heart_rate=source.max_heart_rate,
        color_rows=source.color_rows,
        row_color_mode=source.row_color_mode,
        hr_low=source.hr_low,
        hr_medium=source.hr_medium,
        hr_high=source.hr_high,
        hr_race_5k=source.hr_race_5k,
        hr_race_10k=source.hr_race_10k,
        hr_race_half=source.hr_race_half,
        hr_race_full=source.hr_race_full,
        amedas_station_id=source.amedas_station_id,
        amedas_station_name=source.amedas_station_name,
        updated_at=datetime.now(),
    )


def _clone_run(source: RunningRecord, auth_user_id: int) -> RunningRecord:
    """
    走行記録を別ユーザー向けに複製する。気象行は共有する。

    Args:
        source: コピー元。
        auth_user_id: コピー先のユーザー ID。

    Returns:
        未保存の複製。
    """
    return RunningRecord(
        started_at=source.started_at,
        distance_km=source.distance_km,
        duration_sec=source.duration_sec,
        avg_heart_rate=source.avg_heart_rate,
        notes=source.notes,
        amedas_station_id=source.amedas_station_id,
        amedas_station_name=source.amedas_station_name,
        auth_user_id=auth_user_id,
        weather_observation_id=source.weather_observation_id,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


def copy_legacy_runner_data(db: Session) -> None:
    """
    ユーザー未割当の既存設定・走行を、指定アカウントへ割り当て／コピーする。

    Args:
        db: DB セッション。

    Returns:
        なし。
    """
    users = [
        user
        for email in SHARED_LEGACY_EMAILS
        if (user := db.scalar(select(AuthUser).where(AuthUser.email == email))) is not None
    ]
    if not users:
        return

    source_profile = db.scalar(select(UserProfile).order_by(UserProfile.id.asc()))
    for user in users:
        existing = db.scalar(select(UserProfile).where(UserProfile.auth_user_id == user.id))
        if existing is not None:
            continue
        if source_profile is not None and source_profile.auth_user_id is None:
            source_profile.auth_user_id = user.id
            db.add(source_profile)
            db.flush()
        elif source_profile is not None:
            db.add(_clone_profile(source_profile, user.id))
            db.flush()

    unassigned_runs = db.scalars(
        select(RunningRecord).where(RunningRecord.auth_user_id.is_(None)).order_by(RunningRecord.id.asc())
    ).all()
    if not unassigned_runs:
        return

    owner = users[0]
    for run in unassigned_runs:
        run.auth_user_id = owner.id
        db.add(run)
    db.flush()
    for user in users[1:]:
        has_runs = db.scalar(
            select(func.count()).select_from(RunningRecord).where(RunningRecord.auth_user_id == user.id)
        )
        if has_runs:
            continue
        for run in unassigned_runs:
            db.add(_clone_run(run, user.id))
    db.flush()


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
