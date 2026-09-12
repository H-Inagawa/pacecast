"""メール＋パスワードの認証と、開発者用アカウント。"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from pacecast.models import AuthUser, EmailVerification

logger = logging.getLogger(__name__)

SESSION_COOKIE = "pacecast_session"
SESSION_DAYS = 14
PBKDF2_ITERATIONS = 120_000
TOKEN_HOURS = 24
DEV_EMAIL = os.environ.get("PACECAST_DEV_EMAIL", "dev@pacecast.local").strip().lower()
DEV_PASSWORD = os.environ.get("PACECAST_DEV_PASSWORD", "pacecast-dev")


def _secret() -> str:
    """
    セッション署名に使う秘密を返す。

    Returns:
        環境変数またはローカル既定の秘密。
    """
    return os.environ.get("PACECAST_SECRET", "pacecast-local-secret")


def _app_origin() -> str:
    """
    確認メールに載せる画面の原点を返す。

    Returns:
        ブラウザで開く origin。
    """
    return os.environ.get("PACECAST_APP_ORIGIN", "http://127.0.0.1:3000").rstrip("/")


def normalize_email(value: str) -> str:
    """
    メールアドレスを比較用に整える。

    Args:
        value: 入力されたメールアドレス。

    Returns:
        前後空白を除き小文字にした値。
    """
    return value.strip().lower()


def is_plausible_email(value: str) -> bool:
    """
    最低限のメール形式かを見る。

    Args:
        value: 整えたあとのメールアドレス。

    Returns:
        `@` の前後に文字があり、ドメインに `.` があるとき True。
    """
    if value.count("@") != 1:
        return False
    local, domain = value.split("@")
    return bool(local) and "." in domain and " " not in value


def hash_password(password: str) -> str:
    """
    パスワードを PBKDF2 でハッシュする。

    Args:
        password: 平文パスワード。

    Returns:
        保存用のハッシュ文字列。
    """
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    ).hex()
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """
    平文パスワードが保存ハッシュと一致するか見る。

    Args:
        password: 入力された平文。
        stored: 保存されているハッシュ。

    Returns:
        一致すれば True。
    """
    try:
        scheme, iterations, salt, digest = stored.split("$", 3)
    except ValueError:
        return False
    if scheme != "pbkdf2":
        return False
    expected = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        int(iterations),
    ).hex()
    return hmac.compare_digest(expected, digest)


def make_session_token(user_id: int) -> str:
    """
    ログイン用の署名付きセッショントークンを作る。

    Args:
        user_id: ログインしたユーザーの ID。

    Returns:
        Cookie に入れるトークン。
    """
    expires = int((datetime.now() + timedelta(days=SESSION_DAYS)).timestamp())
    payload = f"{user_id}.{expires}"
    signature = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def read_session_user_id(token: str | None) -> int | None:
    """
    セッショントークンからユーザー ID を取り出す。

    Args:
        token: Cookie の値。

    Returns:
        有効ならユーザー ID。無効・期限切れなら None。
    """
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    user_id_text, expires_text, signature = parts
    payload = f"{user_id_text}.{expires_text}"
    expected = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    try:
        if int(expires_text) < int(datetime.now().timestamp()):
            return None
        return int(user_id_text)
    except ValueError:
        return None


def user_from_session(db: Session, token: str | None) -> AuthUser | None:
    """
    セッショントークンに対応する確認済みユーザーを返す。

    Args:
        db: DB セッション。
        token: Cookie の値。

    Returns:
        確認済みユーザー。無ければ None。
    """
    user_id = read_session_user_id(token)
    if user_id is None:
        return None
    user = db.get(AuthUser, user_id)
    if user is None or not user.email_verified:
        return None
    return user


def ensure_dev_user(db: Session) -> AuthUser:
    """
    開発者用の確認済みユーザーを用意する。

    Args:
        db: DB セッション。

    Returns:
        開発者用ユーザー。
    """
    user = db.scalar(select(AuthUser).where(AuthUser.email == DEV_EMAIL))
    if user is None:
        user = AuthUser(
            email=DEV_EMAIL,
            password_hash=hash_password(DEV_PASSWORD),
            email_verified=True,
            created_at=datetime.now(),
        )
        db.add(user)
        db.flush()
    elif not user.email_verified:
        user.email_verified = True
        db.flush()
    return user


def authenticate(db: Session, email: str, password: str) -> AuthUser:
    """
    メールとパスワードでログインできるユーザーを返す。

    Args:
        db: DB セッション。
        email: 入力メール。
        password: 入力パスワード。

    Returns:
        確認済みユーザー。

    Raises:
        ValueError: 認証できない、またはメール未確認のとき。
    """
    normalized = normalize_email(email)
    if normalized == DEV_EMAIL and password == DEV_PASSWORD:
        return ensure_dev_user(db)

    user = db.scalar(select(AuthUser).where(AuthUser.email == normalized))
    if user is None or not verify_password(password, user.password_hash):
        raise ValueError("メールアドレスまたはパスワードが違います")
    if not user.email_verified:
        raise ValueError("メールの確認がまだです。届いたリンクを開いてください")
    return user


def register_user(db: Session, email: str, password: str) -> tuple[AuthUser, EmailVerification]:
    """
    新規ユーザーを作り、確認トークンを発行する。

    未確認の同じメールなら、確認メールを再送する。

    Args:
        db: DB セッション。
        email: 登録メール。
        password: 登録パスワード。

    Returns:
        ユーザーと確認トークン。

    Raises:
        ValueError: 入力不正、または確認済みで既に登録されているとき。
    """
    normalized = normalize_email(email)
    if not is_plausible_email(normalized):
        raise ValueError("メールアドレスの形式が正しくありません")
    if normalized == DEV_EMAIL:
        raise ValueError("このメールアドレスは開発者用です。ログイン画面から入ってください")
    if len(password) < 8:
        raise ValueError("パスワードは8文字以上にしてください")

    user = db.scalar(select(AuthUser).where(AuthUser.email == normalized))
    if user is not None and user.email_verified:
        raise ValueError("このメールアドレスは登録済みです")
    if user is None:
        user = AuthUser(
            email=normalized,
            password_hash=hash_password(password),
            email_verified=False,
            created_at=datetime.now(),
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(password)

    verification = EmailVerification(
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now() + timedelta(hours=TOKEN_HOURS),
        used_at=None,
        created_at=datetime.now(),
    )
    db.add(verification)
    db.flush()
    return user, verification


def verification_url(token: str) -> str:
    """
    メール確認用の画面 URL を作る。

    Args:
        token: 確認トークン。

    Returns:
        Next.js の確認画面 URL。
    """
    return f"{_app_origin()}/verify?token={token}"


def send_verification_email(to_email: str, url: str) -> bool:
    """
    確認リンクをメールで送る。SMTP が無ければログに残す。

    Args:
        to_email: 宛先。
        url: 確認画面の URL。

    Returns:
        メールを送れたとき True。送れずログだけなら False。
    """
    host = os.environ.get("PACECAST_SMTP_HOST", "").strip()
    if not host:
        logger.info("確認リンク（SMTP 未設定）: %s", url)
        return False

    message = EmailMessage()
    message["Subject"] = "PaceCast のメール確認"
    message["From"] = os.environ.get("PACECAST_SMTP_FROM", "noreply@pacecast.local")
    message["To"] = to_email
    message.set_content(
        "PaceCast の登録を確認してください。\n\n"
        "次のリンクを開くと、メールアドレスが確認されます。\n\n"
        f"{url}\n\n"
        "このリンクは 24 時間有効です。覚えのない登録なら、このメールは無視してください。\n"
    )
    port = int(os.environ.get("PACECAST_SMTP_PORT", "587"))
    user = os.environ.get("PACECAST_SMTP_USER", "")
    password = os.environ.get("PACECAST_SMTP_PASSWORD", "")
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(message)
    return True


def verify_email_token(db: Session, token: str) -> AuthUser:
    """
    確認トークンを使い、ユーザーを確認済みにする。

    Args:
        db: DB セッション。
        token: メールのリンクに付いたトークン。

    Returns:
        確認済みになったユーザー。

    Raises:
        ValueError: トークンが無効・期限切れ・使用済みのとき。
    """
    verification = db.scalar(select(EmailVerification).where(EmailVerification.token == token))
    if verification is None or verification.used_at is not None:
        raise ValueError("確認リンクが無効です")
    if verification.expires_at < datetime.now():
        raise ValueError("確認リンクの期限が切れています。もう一度登録してください")
    user = db.get(AuthUser, verification.user_id)
    if user is None:
        raise ValueError("確認リンクが無効です")
    user.email_verified = True
    verification.used_at = datetime.now()
    db.flush()
    return user
