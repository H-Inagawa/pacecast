"""ログイン・新規登録・メール確認の API。"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from pacecast.db import get_db
from pacecast.schemas import AuthCredentials, AuthUserOut, MeOut, MessageOut, RegisterOut
from pacecast.services.auth import (
    SESSION_COOKIE,
    SESSION_DAYS,
    authenticate,
    make_session_token,
    register_user,
    send_verification_email,
    user_from_session,
    verification_url,
    verify_email_token,
)

router = APIRouter(prefix="/api/auth")


def _set_session(response: Response, user_id: int) -> None:
    """
    ログイン Cookie を付ける。

    Args:
        response: 返却レスポンス。
        user_id: ログインしたユーザーの ID。

    Returns:
        なし。
    """
    response.set_cookie(
        key=SESSION_COOKIE,
        value=make_session_token(user_id),
        httponly=True,
        samesite="lax",
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )


@router.post("/register", response_model=RegisterOut)
def register(body: AuthCredentials, db: Session = Depends(get_db)) -> RegisterOut:
    """
    メールとパスワードで新規登録し、確認リンクを送る。

    Args:
        body: メールとパスワード。
        db: DB セッション。

    Returns:
        案内文。SMTP が無いときは確認 URL も返す。
    """
    try:
        user, verification = register_user(db, body.email, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    url = verification_url(verification.token)
    sent = send_verification_email(user.email, url)
    db.commit()
    if sent:
        return RegisterOut(message="確認メールを送りました。届いたリンクを開いてください。")
    return RegisterOut(
        message="確認メールの送信設定が無いので、下のリンクを開いて確認してください。",
        verification_url=url,
    )


@router.post("/login", response_model=AuthUserOut)
def login(body: AuthCredentials, response: Response, db: Session = Depends(get_db)) -> AuthUserOut:
    """
    メールとパスワードでログインする。

    Args:
        body: メールとパスワード。
        response: Cookie を付けるレスポンス。
        db: DB セッション。

    Returns:
        ログインしたユーザー。
    """
    try:
        user = authenticate(db, body.email, body.password)
    except ValueError as exc:
        status = 403 if "確認" in str(exc) else 401
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    db.commit()
    _set_session(response, user.id)
    return AuthUserOut(id=user.id, email=user.email)


@router.post("/logout", response_model=MessageOut)
def logout(response: Response) -> MessageOut:
    """
    セッション Cookie を消してログアウトする。

    Args:
        response: Cookie を消すレスポンス。

    Returns:
        完了メッセージ。
    """
    response.delete_cookie(SESSION_COOKIE, path="/")
    return MessageOut(message="ログアウトしました")


@router.get("/verify", response_model=AuthUserOut)
def verify(token: str, response: Response, db: Session = Depends(get_db)) -> AuthUserOut:
    """
    メールの確認リンクを処理し、そのままログインする。

    Args:
        token: 確認トークン。
        response: Cookie を付けるレスポンス。
        db: DB セッション。

    Returns:
        確認済みユーザー。
    """
    try:
        user = verify_email_token(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.commit()
    _set_session(response, user.id)
    return AuthUserOut(id=user.id, email=user.email)


@router.get("/me", response_model=MeOut)
def me(request: Request, db: Session = Depends(get_db)) -> MeOut:
    """
    今のセッションが有効かを返す。

    Args:
        request: 現在のリクエスト。
        db: DB セッション。

    Returns:
        ログイン状態とメール。
    """
    user = user_from_session(db, request.cookies.get(SESSION_COOKIE))
    if user is None:
        return MeOut(authenticated=False)
    return MeOut(authenticated=True, email=user.email)
