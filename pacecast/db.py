"""SQLite 接続とテーブル初期化。"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from pacecast.config import DATA_DIR, DB_PATH


class Base(DeclarativeBase):
    """SQLAlchemy モデルの基底クラス。"""


def _database_url(db_path=DB_PATH) -> str:
    """
    SQLite 用の接続 URL を返す。

    Args:
        db_path: データベースファイルのパス。`:memory:` の場合はメモリ DB。

    Returns:
        SQLAlchemy の接続 URL。
    """
    if str(db_path) == ":memory:":
        return "sqlite:///:memory:"
    return f"sqlite:///{db_path}"


def create_engine_for(db_path=DB_PATH):
    """
    SQLite エンジンを生成する。

    Args:
        db_path: データベースファイルのパス。

    Returns:
        SQLAlchemy エンジン。
    """
    if str(db_path) != ":memory:":
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        _database_url(db_path),
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        """
        SQLite の外部キー制約を有効化する。

        Args:
            dbapi_connection: DB-API 接続。
            _connection_record: SQLAlchemy の接続記録（未使用）。

        Returns:
            なし。
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


engine = create_engine_for()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db(bind=None) -> None:
    """
    テーブルが無ければ作成する。

    Args:
        bind: 対象エンジン。省略時は既定の engine。

    Returns:
        なし。
    """
    from pacecast import models  # noqa: F401

    Base.metadata.create_all(bind=bind or engine)


def get_db() -> Generator[Session, None, None]:
    """
    リクエスト単位の DB セッションを提供する。

    Returns:
        SQLAlchemy セッション。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
