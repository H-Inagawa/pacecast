# データベース設計

作成日: 2026-09-06  
更新日: 2026-09-19  
DB: Supabase PostgreSQL（画面）。pytest 用に SQLite（`data/pacecast.db`）も残す。  
DDL: `supabase/schema.sql`

## 1. 方針

- 気象と走行は別テーブルにし、走行側が気象を参照する
- ペースは保存せず、距離と時間から都度計算する
- 将来の地点追加に備え、気象行に地点名を持つ
- 画面は Next.js が service_role で読む。anon は RLS で拒否する
- 日時は timestamptz（東京 +09:00）で保存する

## 2. テーブル

### weather_observations

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| observed_at | DATETIME | NOT NULL | 観測時刻（時別） |
| location | TEXT | NOT NULL | 地点名（例: 練馬） |
| temperature_c | REAL | NOT NULL | 気温（℃） |
| humidity_pct | REAL | NOT NULL | 相対湿度（％） |
| temperature_quality | INTEGER | NULL | 気象庁の品質情報 |
| humidity_quality | INTEGER | NULL | 気象庁の品質情報 |
| wind_ms | REAL | NULL | 風速（m/s）。推定 WBGT の入力 |
| solar_wm2 | REAL | NULL | 全天日射（W/m²）。推定 WBGT の入力 |
| wbgt_c | REAL | NULL | 推定 WBGT（℃） |
| wbgt_method | TEXT | NULL | 式の版（`ono2014`） |
| station_id | TEXT | NULL | アメダス観測所 ID。`(observed_at, station_id)` で一意 |
| source | TEXT | NOT NULL | `amedas` / `open-meteo` など |
| imported_at | DATETIME | NOT NULL | 取り込み日時 |

### running_records

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| started_at | DATETIME | NOT NULL | 走行開始日時 |
| distance_km | REAL | NOT NULL | 走行距離（km） |
| duration_sec | INTEGER | NOT NULL | 走行時間（秒） |
| avg_heart_rate | INTEGER | NULL | 平均心拍数 |
| notes | TEXT | NULL | 任意メモ |
| amedas_station_id | TEXT | NULL | その走のアメダス地点 |
| amedas_station_name | TEXT | NULL | 地点名 |
| auth_user_id | INTEGER | FK, NULL | 所有者。`auth_users.id` |
| weather_observation_id | INTEGER | FK, NULL | 紐付いた気象 |
| created_at | DATETIME | NOT NULL | 登録日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |

外部キー: `weather_observation_id` → `weather_observations.id`（気象削除時は NULL）。`auth_user_id` → `auth_users.id`

### user_profiles

ログインアカウントごとに 1 行。強度別心拍は上書き可能なので列として持つ。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| auth_user_id | INTEGER | UNIQUE, NULL | `auth_users.id`。起動時に未割当の既存行を指定アカウントへ移す |
| display_name | TEXT | NULL | ユーザー名 |
| birthday | DATE | NULL | 誕生日 |
| max_heart_rate | INTEGER | NULL | 最大心拍数 |
| color_rows | INTEGER | NOT NULL | 心拍色分けするか（互換。`row_color_mode=hr` のとき 1） |
| row_color_mode | TEXT | NOT NULL | `hr` / `wbgt` / `off`。心拍は最大心拍が空なら off |
| hr_low / hr_medium / hr_high | INTEGER | NULL | 低・中・高の目標心拍 |
| hr_race_5k / hr_race_10k / hr_race_half / hr_race_full | INTEGER | NULL | レース種目の目標心拍 |
| amedas_station_id | TEXT | NULL | アメダス観測所 ID（未設定時は東京 44132） |
| amedas_station_name | TEXT | NULL | 地点名（例: 東京） |
| run_station_init | TEXT | NOT NULL | 記録追加の初期地点。`profile`（設定どおり）または `gps`（最寄り）。既定は `profile` |
| updated_at | DATETIME | NOT NULL | 更新日時 |

走行・設定は `auth_user_id` でアカウントに紐づく。気象行は地点単位で共有する。

### auth_users

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| email | TEXT | UNIQUE, NOT NULL | ログイン用メール（小文字） |
| password_hash | TEXT | NOT NULL | PBKDF2 |
| email_verified | INTEGER | NOT NULL | 確認リンクを開いたか |
| created_at | DATETIME | NOT NULL | 登録日時 |

開発者用 `dev@pacecast.local` は、そのメールでログインしたときに確認済みで用意する。

### email_verifications

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| user_id | INTEGER | FK, NOT NULL | `auth_users.id` |
| token | TEXT | UNIQUE, NOT NULL | メールの確認トークン |
| expires_at | DATETIME | NOT NULL | 有効期限（24 時間） |
| used_at | DATETIME | NULL | 使用日時 |
| created_at | DATETIME | NOT NULL | 発行日時 |

### password_resets

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 内部 ID |
| user_id | INTEGER | FK, NOT NULL | `auth_users.id` |
| token | TEXT | UNIQUE, NOT NULL | 再設定メールのトークン |
| expires_at | DATETIME | NOT NULL | 有効期限（24 時間） |
| used_at | DATETIME | NULL | 使用日時 |
| created_at | DATETIME | NOT NULL | 発行日時 |

既存の Supabase へ足すときは `supabase/password-resets.sql` を SQL Editor で実行する。

## 3. インデックス

- `weather_observations (observed_at, station_id)`（UNIQUE）
- `weather_observations.observed_at`
- `running_records.started_at`
- `running_records.weather_observation_id`
- `running_records.auth_user_id`
- `user_profiles.auth_user_id`（UNIQUE）
- `auth_users.email`（UNIQUE）
- `email_verifications.token`（UNIQUE）
- `email_verifications.user_id`
- `password_resets.token`（UNIQUE）
- `password_resets.user_id`

## 4. 導出値

- ペース（秒/km）= `duration_sec / distance_km`
- 表示用ペース = 分 + 秒

## 5. 関連付け規則

走行の `started_at` に対し、同じアメダス地点の `weather_observations.observed_at` との絶対差が最小の行を選ぶ。差が同じなら `observed_at` が早い行を選ぶ。候補が無い場合は `weather_observation_id` を NULL にする。

許容差の上限は 90 分とする。それ以上離れた観測は「該当なし」とみなす。
