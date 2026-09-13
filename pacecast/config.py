"""アプリケーション全体で共有するパスと既定値。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "pacecast.db"

DEFAULT_LOCATION = "練馬"
DEFAULT_LATITUDE = 35.6917
DEFAULT_LONGITUDE = 139.7500
DEFAULT_TIMEZONE = "Asia/Tokyo"

# 設定未指定時のアメダス地点（東京）
DEFAULT_AMEDAS_STATION_ID = "44132"
DEFAULT_AMEDAS_STATION_NAME = "東京"

# 既存のテストデータは練馬のまま
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

# 確認メール。資格情報があるときの既定は Gmail
DEFAULT_SMTP_HOST = "smtp.gmail.com"
DEFAULT_SMTP_PORT = 587


@dataclass(frozen=True)
class SmtpSettings:
    """確認メール送信用の SMTP 設定。"""

    host: str
    port: int
    user: str
    password: str
    from_addr: str

    @property
    def enabled(self) -> bool:
        """
        実際に SMTP へ送るかを返す。

        Returns:
            ホストがあり、Gmail 向けにはユーザーとパスワードもあるとき True。
        """
        if not self.host:
            return False
        if self.host == DEFAULT_SMTP_HOST:
            return bool(self.user and self.password)
        return True


def load_local_env() -> None:
    """
    リポジトリ直下の `.env` を読む。すでに環境にある値は上書きしない。

    Returns:
        なし。
    """
    path = ROOT_DIR / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def smtp_settings() -> SmtpSettings:
    """
    確認メール用の SMTP 設定を返す。資格情報があればホスト未指定でも Gmail を使う。

    Returns:
        SMTP ホスト・ポート・認証情報。
    """
    user = os.environ.get("PACECAST_SMTP_USER", "").strip()
    password = os.environ.get("PACECAST_SMTP_PASSWORD", "").replace(" ", "").strip()
    explicit_host = os.environ.get("PACECAST_SMTP_HOST", "").strip()
    host = explicit_host or (DEFAULT_SMTP_HOST if user and password else "")
    raw_port = os.environ.get("PACECAST_SMTP_PORT", "").strip()
    port = int(raw_port) if raw_port else DEFAULT_SMTP_PORT
    from_addr = os.environ.get("PACECAST_SMTP_FROM", "").strip() or user or "noreply@pacecast.local"
    return SmtpSettings(
        host=host,
        port=port,
        user=user,
        password=password,
        from_addr=from_addr,
    )


load_local_env()
