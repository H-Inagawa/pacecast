"""ログイン・新規登録・メール確認。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from pacecast.config import DEFAULT_SMTP_HOST, smtp_settings
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


class _FakeSMTP:
    """Gmail SMTP の代わりに、渡された内容だけ覚える。"""

    last: dict = {}

    def __init__(self, host: str, port: int, timeout: int | None = None) -> None:
        self.__class__.last = {"host": host, "port": port, "timeout": timeout}

    def __enter__(self) -> "_FakeSMTP":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def ehlo(self) -> None:
        self.__class__.last["ehlo"] = self.__class__.last.get("ehlo", 0) + 1

    def starttls(self) -> None:
        self.__class__.last["starttls"] = True

    def login(self, user: str, password: str) -> None:
        self.__class__.last["user"] = user
        self.__class__.last["password"] = password

    def send_message(self, message) -> None:
        self.__class__.last["to"] = message["To"]
        self.__class__.last["from"] = message["From"]
        self.__class__.last["body"] = message.get_content()


def test_smtp_settings_use_gmail_when_credentials_set(monkeypatch) -> None:
    """ユーザーとアプリパスワードがあればホスト未指定でも Gmail を使う。"""
    monkeypatch.setenv("PACECAST_SMTP_USER", "sender@gmail.com")
    monkeypatch.setenv("PACECAST_SMTP_PASSWORD", "abcd efgh ijkl mnop")
    settings = smtp_settings()
    assert settings.enabled
    assert settings.host == DEFAULT_SMTP_HOST
    assert settings.port == 587
    assert settings.password == "abcdefghijklmnop"
    assert settings.from_addr == "sender@gmail.com"


def test_smtp_settings_disabled_without_credentials() -> None:
    """資格情報が無いときは送らない。"""
    assert smtp_settings().enabled is False


def test_register_sends_gmail_when_credentials_set(db, monkeypatch) -> None:
    """Gmail のアプリパスワードがあれば smtp.gmail.com へ送る。"""
    monkeypatch.setenv("PACECAST_SMTP_USER", "sender@gmail.com")
    monkeypatch.setenv("PACECAST_SMTP_PASSWORD", "abcd efgh ijkl mnop")
    monkeypatch.setattr("pacecast.services.auth.smtplib.SMTP", _FakeSMTP)

    client = _client(db)
    created = client.post(
        "/api/auth/register",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload.get("verification_url") is None
    assert "確認メールを送りました" in payload["message"]
    assert _FakeSMTP.last["host"] == "smtp.gmail.com"
    assert _FakeSMTP.last["port"] == 587
    assert _FakeSMTP.last["starttls"] is True
    assert _FakeSMTP.last["user"] == "sender@gmail.com"
    assert _FakeSMTP.last["password"] == "abcdefghijklmnop"
    assert _FakeSMTP.last["from"] == "sender@gmail.com"
    assert _FakeSMTP.last["to"] == "runner@example.com"
    assert "token=" in _FakeSMTP.last["body"]


def test_register_reports_smtp_failure(db, monkeypatch) -> None:
    """SMTP が設定済みで送れないと、画面に分かるエラーを返す。"""
    monkeypatch.setenv("PACECAST_SMTP_USER", "sender@gmail.com")
    monkeypatch.setenv("PACECAST_SMTP_PASSWORD", "bad-password")

    class _FailSMTP:
        def __init__(self, *_args, **_kwargs) -> None:
            raise OSError("connection refused")

    monkeypatch.setattr("pacecast.services.auth.smtplib.SMTP", _FailSMTP)
    client = _client(db)
    created = client.post(
        "/api/auth/register",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    assert created.status_code == 502
    assert "確認メールを送れませんでした" in created.json()["detail"]


def test_forgot_password_unknown_email_looks_the_same(db) -> None:
    """未登録メールでも成功と同じ案内を返す。"""
    client = _client(db)
    response = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("reset_url") is None
    assert "アカウントがあれば" in payload["message"]


def test_reset_password_from_link_then_login(db) -> None:
    """再設定リンクからパスワードを変え、新しいパスワードで入れる。"""
    client = _client(db)
    created = client.post(
        "/api/auth/register",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    token = created.json()["verification_url"].split("token=", 1)[1]
    assert client.get(f"/api/auth/verify?token={token}").status_code == 200
    client.post("/api/auth/logout")

    asked = client.post("/api/auth/forgot-password", json={"email": "runner@example.com"})
    assert asked.status_code == 200
    reset_url = asked.json()["reset_url"]
    assert reset_url and "token=" in reset_url
    reset_token = reset_url.split("token=", 1)[1]

    changed = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "password": "newpass12"},
    )
    assert changed.status_code == 200
    assert client.get("/api/profile").status_code == 200
    client.post("/api/auth/logout")

    old = client.post(
        "/api/auth/login",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    assert old.status_code == 401
    new = client.post(
        "/api/auth/login",
        json={"email": "runner@example.com", "password": "newpass12"},
    )
    assert new.status_code == 200


def test_forgot_password_sends_gmail_when_credentials_set(db, monkeypatch) -> None:
    """SMTP があれば再設定メールを送り、画面にリンクを出さない。"""
    client = _client(db)
    created = client.post(
        "/api/auth/register",
        json={"email": "runner@example.com", "password": "secret123"},
    )
    token = created.json()["verification_url"].split("token=", 1)[1]
    assert client.get(f"/api/auth/verify?token={token}").status_code == 200

    monkeypatch.setenv("PACECAST_SMTP_USER", "sender@gmail.com")
    monkeypatch.setenv("PACECAST_SMTP_PASSWORD", "abcd efgh ijkl mnop")
    monkeypatch.setattr("pacecast.services.auth.smtplib.SMTP", _FakeSMTP)

    asked = client.post("/api/auth/forgot-password", json={"email": "runner@example.com"})
    assert asked.status_code == 200
    payload = asked.json()
    assert payload.get("reset_url") is None
    assert "アカウントがあれば" in payload["message"]
    assert _FakeSMTP.last["to"] == "runner@example.com"
    assert "token=" in _FakeSMTP.last["body"]
    assert "パスワード再設定" in _FakeSMTP.last["body"] or "reset-password" in _FakeSMTP.last["body"]
