"""アプリケーション全体で共有するパスと既定値。"""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "pacecast.db"
DEFAULT_WEATHER_CSV = DATA_DIR / "weather" / "data.csv"

DEFAULT_LOCATION = "練馬"
DEFAULT_LATITUDE = 35.7356
DEFAULT_LONGITUDE = 139.6517
DEFAULT_TIMEZONE = "Asia/Tokyo"

# 走行開始時刻からこの分数を超える気象観測は未関連とする
MATCH_MAX_DELTA_MINUTES = 90

# 予測で「近い」とみなす気象距離（1℃ または湿度 5% が距離 1）
NEAR_WEATHER_DISTANCE = 2.0
