"""アプリケーション全体で共有するパスと既定値。"""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "pacecast.db"
DEFAULT_WEATHER_CSV = DATA_DIR / "weather" / "data.csv"

DEFAULT_LOCATION = "練馬"
DEFAULT_LATITUDE = 35.6917
DEFAULT_LONGITUDE = 139.7500
DEFAULT_TIMEZONE = "Asia/Tokyo"

# 設定未指定時のアメダス地点（東京）
DEFAULT_AMEDAS_STATION_ID = "44132"
DEFAULT_AMEDAS_STATION_NAME = "東京"

# サンプル CSV・既存テストデータは練馬のまま
SAMPLE_AMEDAS_STATION_ID = "44071"
SAMPLE_AMEDAS_STATION_NAME = "練馬"

# 走行開始時刻からこの分数を超える気象観測は未関連とする
MATCH_MAX_DELTA_MINUTES = 90

# 予測で「近い」とみなす気象距離（推定 WBGT の差がこの値以下）
NEAR_WEATHER_DISTANCE = 2.0

# 小野・登内 (2014) / 環境省の実況推定と同じ式
WBGT_METHOD = "ono2014"

# 風・日射が取れないときの仮定（手動予測のフォールバック）
DEFAULT_WIND_MS = 2.0
DEFAULT_SOLAR_WM2_DAY = 400.0
DEFAULT_SOLAR_WM2_NIGHT = 0.0
