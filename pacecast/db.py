"""SQLite 接続とテーブル初期化。"""

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
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

    target = bind or engine
    Base.metadata.create_all(bind=target)
    migrate_schema(target)


def migrate_schema(bind=None) -> None:
    """
    既存 SQLite に不足している列を追加する。

    Args:
        bind: 対象エンジン。省略時は既定の engine。

    Returns:
        なし。
    """
    target = bind or engine
    additions = {
        "weather_observations": (
            ("wind_ms", "REAL"),
            ("solar_wm2", "REAL"),
            ("wbgt_c", "REAL"),
            ("wbgt_method", "TEXT"),
            ("station_id", "TEXT"),
        ),
        "user_profiles": (
            ("amedas_station_id", "TEXT"),
            ("amedas_station_name", "TEXT"),
        ),
        "running_records": (
            ("amedas_station_id", "TEXT"),
            ("amedas_station_name", "TEXT"),
        ),
    }
    with target.begin() as connection:
        for table_name, columns in additions.items():
            existing = {
                row[1]
                for row in connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            }
            if not existing:
                continue
            for column_name, column_type in columns:
                if column_name in existing:
                    continue
                connection.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                )
        _fill_legacy_station_ids(connection)
    _rebuild_weather_unique_if_needed(target)


def _fill_legacy_station_ids(connection) -> None:
    """
    地点が空の気象・走行に、既存テストデータの練馬を入れる。

    設定の未指定既定（東京）は上書きしない。

    Args:
        connection: 開いている DB 接続。

    Returns:
        なし。
    """
    from pacecast.config import SAMPLE_AMEDAS_STATION_ID, SAMPLE_AMEDAS_STATION_NAME

    weather_cols = {
        row[1] for row in connection.execute(text("PRAGMA table_info(weather_observations)")).fetchall()
    }
    if "station_id" in weather_cols:
        connection.execute(
            text(
                "UPDATE weather_observations SET station_id = :sid "
                "WHERE station_id IS NULL OR station_id = ''"
            ),
            {"sid": SAMPLE_AMEDAS_STATION_ID},
        )
    run_cols = {row[1] for row in connection.execute(text("PRAGMA table_info(running_records)")).fetchall()}
    if "amedas_station_id" in run_cols:
        connection.execute(
            text(
                "UPDATE running_records SET amedas_station_id = :sid, amedas_station_name = :sname "
                "WHERE amedas_station_id IS NULL OR amedas_station_id = ''"
            ),
            {"sid": SAMPLE_AMEDAS_STATION_ID, "sname": SAMPLE_AMEDAS_STATION_NAME},
        )


def _rebuild_weather_unique_if_needed(bind) -> None:
    """
    気象の UNIQUE が観測時刻だけなら、(時刻, 地点) に作り直す。

    外部キーは別接続で切る。同じトランザクション内だと PRAGMA が効かない。

    Args:
        bind: SQLAlchemy エンジン。

    Returns:
        なし。
    """
    raw = bind.raw_connection()
    try:
        cursor = raw.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        if "weather_observations" not in tables:
            return
        cursor.execute("PRAGMA index_list(weather_observations)")
        needs_rebuild = False
        for index in cursor.fetchall():
            if not index[2]:
                continue
            cursor.execute(f"PRAGMA index_info({index[1]})")
            columns = [row[2] for row in cursor.fetchall()]
            if columns == ["observed_at"]:
                needs_rebuild = True
                break
        if not needs_rebuild:
            return

        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute(
            """
            CREATE TABLE weather_observations_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                observed_at DATETIME NOT NULL,
                location VARCHAR(64) NOT NULL,
                temperature_c FLOAT NOT NULL,
                humidity_pct FLOAT NOT NULL,
                temperature_quality INTEGER,
                humidity_quality INTEGER,
                wind_ms FLOAT,
                solar_wm2 FLOAT,
                wbgt_c FLOAT,
                wbgt_method VARCHAR(32),
                station_id VARCHAR(16),
                source VARCHAR(32) NOT NULL,
                imported_at DATETIME NOT NULL,
                UNIQUE (observed_at, station_id)
            )
            """
        )
        cursor.execute(
            """
            INSERT INTO weather_observations_new (
                id, observed_at, location, temperature_c, humidity_pct,
                temperature_quality, humidity_quality, wind_ms, solar_wm2,
                wbgt_c, wbgt_method, station_id, source, imported_at
            )
            SELECT
                id, observed_at, location, temperature_c, humidity_pct,
                temperature_quality, humidity_quality, wind_ms, solar_wm2,
                wbgt_c, wbgt_method, station_id, source, imported_at
            FROM weather_observations
            """
        )
        cursor.execute("DROP TABLE weather_observations")
        cursor.execute("ALTER TABLE weather_observations_new RENAME TO weather_observations")
        cursor.execute(
            "CREATE INDEX ix_weather_observations_observed_at ON weather_observations (observed_at)"
        )
        cursor.execute("PRAGMA foreign_keys=ON")
        raw.commit()
    finally:
        raw.close()


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
