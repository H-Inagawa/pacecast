"""ローカル SQLite を Supabase PostgreSQL へコピーする。"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE = ROOT / "data" / "pacecast.db"


def load_dotenv(path: Path) -> None:
    """
    `.env` の値を、まだ無い環境変数へ入れる。

    Args:
        path: 読み込むファイル。

    Returns:
        なし。
    """
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and not os.environ.get(key):
            os.environ[key] = value


def to_timestamptz(value: object | None) -> str | None:
    """
    SQLite の素の日時を東京オフセット付きにする。

    Args:
        value: SQLite の DATETIME 文字列。

    Returns:
        `YYYY-MM-DDTHH:MM:SS+09:00`。空なら None。
    """
    if value is None:
        return None
    text = str(value).strip().replace(" ", "T")
    if not text:
        return None
    if text.endswith(("Z", "z")) or (len(text) > 10 and ("+" in text[10:] or text.count("-") > 2)):
        return text
    if "." in text:
        text = text.split(".", 1)[0]
    if len(text) == 16:
        text += ":00"
    return f"{text}+09:00"


def as_bool(value: object | None, default: bool = False) -> bool:
    """
    SQLite の 0/1 を真偽値にする。

    Args:
        value: 保存値。
        default: NULL のときの値。

    Returns:
        真偽値。
    """
    if value is None:
        return default
    return bool(value)


class RestClient:
    """Supabase PostgREST への簡単な POST。"""

    def __init__(self, url: str, service_key: str) -> None:
        self.base = url.rstrip("/")
        self.service_key = service_key

    def insert(self, table: str, rows: list[dict[str, object]]) -> None:
        """
        1テーブルへ行を追加する。

        Args:
            table: テーブル名。
            rows: 追加する行。

        Returns:
            なし。
        """
        if not rows:
            return
        self._request("POST", f"/rest/v1/{table}", rows, {"Prefer": "return=minimal"})

    def rpc(self, name: str) -> None:
        """
        SQL 関数を呼ぶ。

        Args:
            name: 関数名。

        Returns:
            なし。
        """
        self._request("POST", f"/rest/v1/rpc/{name}", {}, {"Prefer": "return=minimal"})

    def _request(self, method: str, path: str, payload: object, extra: dict[str, str]) -> None:
        """
        JSON を送る。

        Args:
            method: HTTP メソッド。
            path: パス。
            payload: JSON 本体。
            extra: 追加ヘッダ。

        Returns:
            なし。
        """
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base + path,
            data=body,
            method=method,
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
                **extra,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Supabase への書き込みに失敗しました ({exc.code} {path}): {detail}") from exc


def fetch_rows(db: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    """
    SQLite の全行を返す。

    Args:
        db: 接続。
        table: テーブル名。

    Returns:
        行のリスト。テーブルが無ければ空。
    """
    exists = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    if exists is None:
        return []
    return list(db.execute(f"SELECT * FROM {table}"))


def main() -> None:
    """
    SQLite の内容を Supabase へコピーする。

    Returns:
        なし。
    """
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / "web" / ".env.local")
    sqlite_path = Path(os.environ.get("PACECAST_SQLITE", DEFAULT_SQLITE))
    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        print("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env または web/.env.local に入れてください", file=sys.stderr)
        raise SystemExit(1)
    if not sqlite_path.is_file():
        print(f"SQLite がありません: {sqlite_path}", file=sys.stderr)
        raise SystemExit(1)

    db = sqlite3.connect(sqlite_path)
    db.row_factory = sqlite3.Row
    client = RestClient(url, key)

    auth_users = [
        {
            "id": row["id"],
            "email": row["email"],
            "password_hash": row["password_hash"],
            "email_verified": as_bool(row["email_verified"]),
            "created_at": to_timestamptz(row["created_at"]),
        }
        for row in fetch_rows(db, "auth_users")
    ]
    client.insert("auth_users", auth_users)

    client.insert(
        "email_verifications",
        [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "token": row["token"],
                "expires_at": to_timestamptz(row["expires_at"]),
                "used_at": to_timestamptz(row["used_at"]),
                "created_at": to_timestamptz(row["created_at"]),
            }
            for row in fetch_rows(db, "email_verifications")
        ],
    )

    client.insert(
        "weather_observations",
        [
            {
                "id": row["id"],
                "observed_at": to_timestamptz(row["observed_at"]),
                "location": row["location"],
                "temperature_c": row["temperature_c"],
                "humidity_pct": row["humidity_pct"],
                "temperature_quality": row["temperature_quality"],
                "humidity_quality": row["humidity_quality"],
                "wind_ms": row["wind_ms"],
                "solar_wm2": row["solar_wm2"],
                "wbgt_c": row["wbgt_c"],
                "wbgt_method": row["wbgt_method"],
                "station_id": row["station_id"],
                "source": row["source"] or "open-meteo",
                "imported_at": to_timestamptz(row["imported_at"]),
            }
            for row in fetch_rows(db, "weather_observations")
        ],
    )

    client.insert(
        "user_profiles",
        [
            {
                "id": row["id"],
                "auth_user_id": row["auth_user_id"],
                "display_name": row["display_name"],
                "birthday": row["birthday"],
                "max_heart_rate": row["max_heart_rate"],
                "color_rows": as_bool(row["color_rows"], True),
                "row_color_mode": row["row_color_mode"] or "hr",
                "hr_low": row["hr_low"],
                "hr_medium": row["hr_medium"],
                "hr_high": row["hr_high"],
                "hr_race_5k": row["hr_race_5k"],
                "hr_race_10k": row["hr_race_10k"],
                "hr_race_half": row["hr_race_half"],
                "hr_race_full": row["hr_race_full"],
                "amedas_station_id": row["amedas_station_id"],
                "amedas_station_name": row["amedas_station_name"],
                "run_station_init": row["run_station_init"] if "run_station_init" in row.keys() else "profile",
                "updated_at": to_timestamptz(row["updated_at"]),
            }
            for row in fetch_rows(db, "user_profiles")
        ],
    )

    client.insert(
        "running_records",
        [
            {
                "id": row["id"],
                "started_at": to_timestamptz(row["started_at"]),
                "distance_km": row["distance_km"],
                "duration_sec": row["duration_sec"],
                "avg_heart_rate": row["avg_heart_rate"],
                "notes": row["notes"],
                "amedas_station_id": row["amedas_station_id"],
                "amedas_station_name": row["amedas_station_name"],
                "auth_user_id": row["auth_user_id"],
                "weather_observation_id": row["weather_observation_id"],
                "created_at": to_timestamptz(row["created_at"]),
                "updated_at": to_timestamptz(row["updated_at"]),
            }
            for row in fetch_rows(db, "running_records")
        ],
    )

    client.rpc("reset_id_sequences")
    print(
        "コピーしました: "
        f"users={len(auth_users)} "
        f"weather={len(fetch_rows(db, 'weather_observations'))} "
        f"runs={len(fetch_rows(db, 'running_records'))}"
    )


if __name__ == "__main__":
    main()
