# データベース設計

作成日: 2026-09-06  
DB: SQLite（`data/pacecast.db`）

## 1. 方針

- 気象と走行は別テーブルにし、走行側が気象を参照する
- ペースは保存せず、距離と時間から都度計算する
- 将来の地点追加に備え、気象行に地点名を持つ

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
| source | TEXT | NOT NULL | `csv` など |
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
| weather_observation_id | INTEGER | FK, NULL | 紐付いた気象 |
| created_at | DATETIME | NOT NULL | 登録日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |

外部キー: `weather_observation_id` → `weather_observations.id`（気象削除時は NULL）

### user_profiles

単一行（id = 1）。強度別心拍は上書き可能なので列として持つ。

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| id | INTEGER | PK | 常に 1 |
| display_name | TEXT | NULL | ユーザー名 |
| birthday | DATE | NULL | 誕生日 |
| max_heart_rate | INTEGER | NULL | 最大心拍数 |
| color_rows | INTEGER | NOT NULL | 行の色分け（0/1）。最大心拍が空なら無効 |
| hr_low / hr_medium / hr_high | INTEGER | NULL | 低・中・高の目標心拍 |
| hr_race_5k / hr_race_10k / hr_race_half / hr_race_full | INTEGER | NULL | レース種目の目標心拍 |
| amedas_station_id | TEXT | NULL | アメダス観測所 ID（未設定時は東京 44132） |
| amedas_station_name | TEXT | NULL | 地点名（例: 東京） |
| updated_at | DATETIME | NOT NULL | 更新日時 |

## 3. インデックス

- `weather_observations (observed_at, station_id)`（UNIQUE）
- `weather_observations.observed_at`
- `running_records.started_at`
- `running_records.weather_observation_id`

## 4. 導出値

- ペース（秒/km）= `duration_sec / distance_km`
- 表示用ペース = 分 + 秒

## 5. 関連付け規則

走行の `started_at` に対し、同じアメダス地点の `weather_observations.observed_at` との絶対差が最小の行を選ぶ。差が同じなら `observed_at` が早い行を選ぶ。候補が無い場合は `weather_observation_id` を NULL にする。

許容差の上限は 90 分とする。それ以上離れた観測は「該当なし」とみなす。
