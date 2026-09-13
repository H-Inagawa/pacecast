"""テスト用の DB セッション。"""

from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from pacecast.db import create_engine_for, init_db

SMTP_ENV_KEYS = (
    "PACECAST_SMTP_HOST",
    "PACECAST_SMTP_PORT",
    "PACECAST_SMTP_USER",
    "PACECAST_SMTP_PASSWORD",
    "PACECAST_SMTP_FROM",
)


@pytest.fixture(autouse=True)
def isolate_smtp_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    ローカルの `.env` があっても、テストから実 SMTP に繋がらないようにする。

    Args:
        monkeypatch: 環境変数を戻す pytest の道具。

    Returns:
        なし。
    """
    for key in SMTP_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def db(tmp_path: Path):
    """
    一時 SQLite のセッションを返す。

    Args:
        tmp_path: pytest の一時ディレクトリ。

    Returns:
        テスト用セッション。
    """
    engine = create_engine_for(tmp_path / "test.db")
    init_db(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()
