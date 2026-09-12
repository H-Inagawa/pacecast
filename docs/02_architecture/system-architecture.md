# システム構成

更新日: 2026-09-06

## 1. 構成と選定理由

| 層 | 選択 | 理由 |
| --- | --- | --- |
| 言語 | Python 3.11+ | データ処理と将来の分析・ML への接続が容易 |
| API | FastAPI | JSON API。予測・取り込み・永続化を担当 |
| 画面 | Next.js（App Router） | 画面追加と入力制御をフロントに閉じる |
| DB | SQLite | セットアップ不要で履歴をファイルとして残せる |
| ORM | SQLAlchemy 2.0 | スキーマ変更とテスト用 DB 切り替えがしやすい |
| 予報・再解析 | Open-Meteo | API キー不要。気温・湿度に加え風速・日射を取り、推定 WBGT に使う |
| アメダス | 気象庁 bosai JSON | 地点マスタと、直近数日の気温・湿度・風 |

## 2. 構成図

```
[Browser] http://127.0.0.1:3000
    |
    v
[Next.js / web]  --rewrite /api/*-->  [FastAPI :8000]
                                          |
                                          +-- services/weather_import
                                          +-- services/matching
                                          +-- services/intensity
                                          +-- services/prediction
                                          +-- services/forecast
                                          +-- services/amedas
                                          +-- services/wbgt
                                          +-- services/weather_sync
                                          |
                                          v
                                     [SQLite] data/pacecast.db
```

詳細は `frontend-nextjs.md` と `intensity-prediction.md` を参照。

## 3. ディレクトリ

```
web/                Next.js 画面
pacecast/           API と業務ロジック
  services/
  routers/api.py
tests/
data/weather/
docs/
```

## 4. 起動時の動き

1. FastAPI が SQLite を初期化
2. 気象テーブルが空で既定 CSV があれば自動取り込み
3. Next.js が画面を提供し、`/api` を FastAPI へ転送
