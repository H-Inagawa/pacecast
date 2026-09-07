"""PaceCast API のエントリポイント。画面は Next.js が担当する。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pacecast import __version__
from pacecast.db import SessionLocal, init_db
from pacecast.routers.api import router as api_router
from pacecast.services.weather_import import import_default_weather_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    起動時に DB を初期化し、空なら気象 CSV を取り込む。

    Args:
        _app: FastAPI アプリケーション（未使用）。

    Returns:
        なし。シャットダウン時も特別な処理はしない。
    """
    init_db()
    db = SessionLocal()
    try:
        import_default_weather_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="PaceCast API", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)
