"""ログイン・新規登録・メール確認。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from pacecast.db import get_db
from pacecast.routers.api import router as api_router
from pacecast.routers.auth import router as auth_router
from pacecast.services.auth import (
    DEV_EMAIL,
    DEV_PASSWORD,
    authenticate,
    hash_password,
    make_session_token,
    read_session_user_id,
    register_user,
    verify_email_token,
    verify_password,
)


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


def test_password_hash_roundtrip() -> None:
    """同じパスワードは通り、違うパスワードは落ちる。"""
    stored = hash_password("secret-pass")
    assert verify_password("secret-pass", stored)
    assert not verify_password("other-pass", stored)


def test_session_token_roundtrip() -> None:
    """署名付きセッションからユーザー ID を戻せる。"""
    token = make_session_token(7)
    assert read_session_user_id(token) == 7
    assert read_session_user_id("7.1.deadbeef") is None


def test_dev_login_reaches_profile(db) -> None:
    """開発者用アカウントは登録なしでメイン API に進める。"""
    client = _client(db)
    denied = client.get("/api/profile")
    assert denied.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"email": DEV_EMAIL, "password": DEV_PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["email"] == DEV_EMAIL

    profile = client.get("/api/profile")
    assert profile.status_code == 200


def test_register_verify_then_login(db) -> None:
    """新規登録は確認リンクを開くまでログインできない。"""
    client = _client(db)
    created = client.post(
        "/api/auth/register",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    assert created.status_code == 200
    url = created.json()["verification_url"]
    assert url and "token=" in url
    token = url.split("token=", 1)[1]

    blocked = client.post(
        "/api/auth/login",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    assert blocked.status_code == 403

    verified = client.get(f"/api/auth/verify?token={token}")
    assert verified.status_code == 200
    assert client.get("/api/profile").status_code == 200


def test_register_rejects_dev_email(db) -> None:
    """開発者用メールでは新規登録できない。"""
    client = _client(db)
    response = client.post(
        "/api/auth/register",
        json={"email": DEV_EMAIL, "password": "secret123"},
    )
    assert response.status_code == 400


def test_logout_clears_session(db) -> None:
    """ログアウトすると保護 API に戻れない。"""
    client = _client(db)
    client.post("/api/auth/login", json={"email": DEV_EMAIL, "password": DEV_PASSWORD})
    assert client.get("/api/profile").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/profile").status_code == 401


def test_authenticate_service_dev_user(db) -> None:
    """開発者用の固定情報でユーザーを取得できる。"""
    user = authenticate(db, DEV_EMAIL, DEV_PASSWORD)
    assert user.email == DEV_EMAIL
    assert user.email_verified


def test_verify_token_marks_user(db) -> None:
    """確認トークンを使うとメール確認済みになる。"""
    user, verification = register_user(db, "new@example.com", "secret123")
    db.commit()
    assert user.email_verified is False
    verified = verify_email_token(db, verification.token)
    assert verified.email_verified is True
