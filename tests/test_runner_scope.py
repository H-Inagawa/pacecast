"""ランナーごとの走行・設定の分離。"""

from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from pacecast.db import get_db
from pacecast.models import AuthUser, RunningRecord, UserProfile
from pacecast.routers.api import router as api_router
from pacecast.routers.auth import router as auth_router
from pacecast.services.auth import DEV_EMAIL, DEV_PASSWORD, hash_password, register_user
from pacecast.services.profile import SHARED_LEGACY_EMAILS, copy_legacy_runner_data, get_or_create_profile


def _client(db) -> TestClient:
    """
    テスト用 DB を使う API クライアントを返す。

    Args:
        db: pytest のセッション。

    Returns:
        FastAPI の TestClient。
    """
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(api_router)

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def _add_run(db, auth_user_id: int | None, started_at: datetime, distance_km: float = 5.0) -> RunningRecord:
    """
    走行記録を1件入れる。

    Args:
        db: セッション。
        auth_user_id: 所有者。未割当なら None。
        started_at: 開始日時。
        distance_km: 距離。

    Returns:
        保存した走行記録。
    """
    record = RunningRecord(
        started_at=started_at,
        distance_km=distance_km,
        duration_sec=1500,
        auth_user_id=auth_user_id,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def test_copy_legacy_data_to_shared_accounts(db) -> None:
    """未割当の既存データは、指定の2アカウントへコピーされる。"""
    gmail = AuthUser(
        email=SHARED_LEGACY_EMAILS[1],
        password_hash=hash_password("secret123"),
        email_verified=True,
        created_at=datetime(2026, 1, 1),
    )
    db.add(gmail)
    db.add(
        UserProfile(
            display_name="あい",
            max_heart_rate=189,
            color_rows=True,
            row_color_mode="hr",
            amedas_station_id="44071",
            amedas_station_name="練馬",
            updated_at=datetime(2026, 1, 1),
        )
    )
    _add_run(db, None, datetime(2026, 5, 24, 20, 56), 10.0)
    copy_legacy_runner_data(db)
    db.commit()

    profiles = {
        profile.auth_user_id: profile
        for profile in db.scalars(select(UserProfile).where(UserProfile.auth_user_id.is_not(None)))
    }
    assert len(profiles) == 2
    for profile in profiles.values():
        assert profile.display_name == "あい"
        assert profile.max_heart_rate == 189
        assert profile.amedas_station_id == "44071"

    users = {
        user.email: user.id
        for user in db.scalars(select(AuthUser).where(AuthUser.email.in_(SHARED_LEGACY_EMAILS)))
    }
    for user_id in users.values():
        runs = db.scalars(select(RunningRecord).where(RunningRecord.auth_user_id == user_id)).all()
        assert len(runs) == 1
        assert runs[0].distance_km == 10.0


def test_copy_legacy_data_is_idempotent(db) -> None:
    """移行を二度走らせても、走行は増えない。"""
    gmail = AuthUser(
        email=SHARED_LEGACY_EMAILS[1],
        password_hash=hash_password("secret123"),
        email_verified=True,
        created_at=datetime(2026, 1, 1),
    )
    db.add(gmail)
    db.add(
        UserProfile(
            display_name="あい",
            color_rows=True,
            row_color_mode="hr",
            updated_at=datetime(2026, 1, 1),
        )
    )
    _add_run(db, None, datetime(2026, 5, 24, 20, 56))
    copy_legacy_runner_data(db)
    db.commit()
    copy_legacy_runner_data(db)
    db.commit()

    total = db.scalar(select(func.count()).select_from(RunningRecord))
    assert total == 2


def test_list_runs_hides_other_runners(db) -> None:
    """走行一覧はログイン中のユーザーの分だけ返す。"""
    other, _verification = register_user(db, "other@example.com", "secret123")
    other.email_verified = True
    db.commit()
    hidden = _add_run(db, other.id, datetime(2026, 6, 1, 7, 0), 8.0)
    dev = db.scalar(select(AuthUser).where(AuthUser.email == DEV_EMAIL))
    assert dev is not None
    own = _add_run(db, dev.id, datetime(2026, 6, 2, 7, 0))

    client = _client(db)
    client.post("/api/auth/login", json={"email": DEV_EMAIL, "password": DEV_PASSWORD})
    runs = client.get("/api/runs").json()
    assert [item["id"] for item in runs] == [own.id]
    assert client.get(f"/api/runs/{own.id}").status_code == 200
    assert client.get(f"/api/runs/{hidden.id}").status_code == 404


def test_new_user_starts_with_empty_profile(db) -> None:
    """コピー対象外の新規ユーザーは、空の設定から始まる。"""
    user, verification = register_user(db, "new-runner@example.com", "secret123")
    db.commit()
    client = _client(db)
    client.get(f"/api/auth/verify?token={verification.token}")
    profile = client.get("/api/profile").json()
    assert profile["display_name"] is None
    assert profile["run_count"] == 0
    assert client.get("/api/runs").json() == []
    stored = get_or_create_profile(db, user)
    assert stored.auth_user_id == user.id
