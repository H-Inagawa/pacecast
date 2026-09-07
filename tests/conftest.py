"""テスト用の DB セッション。"""

from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from pacecast.db import create_engine_for, init_db


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
