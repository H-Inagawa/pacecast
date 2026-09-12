"""API 共通の依存関係。"""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from pacecast.db import get_db
from pacecast.models import AuthUser
from pacecast.services.auth import SESSION_COOKIE, user_from_session


def require_user(request: Request, db: Session = Depends(get_db)) -> AuthUser:
    """
    ログイン済みの確認済みユーザーを返す。

    Args:
        request: 現在の HTTP リクエスト。
        db: DB セッション。

    Returns:
        セッションに紐づくユーザー。

    Raises:
        HTTPException: 未ログイン、またはセッションが無効なとき。
    """
    user = user_from_session(db, request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise HTTPException(status_code=401, detail="ログインしてください")
    return user
