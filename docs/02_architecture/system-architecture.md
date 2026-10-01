# システム構成

更新日: 2026-09-16

## 1. 構成と選定理由

| 層 | 選択 | 理由 |
| --- | --- | --- |
| 画面と API | Next.js（App Router + Route Handlers） | 画面と JSON API を同じプロセスに閉じ、Vercel へ載せやすい |
| DB | Supabase PostgreSQL | 複数 PC で同じ履歴を共有する。SQLite は公開先で残らない |
| 接続 | service_role（サーバのみ） | ブラウザから DB を直叩きしない。RLS で anon を拒否する |
| 認証 | アプリ独自（PBKDF2 + Cookie） | 既存の確認メールと開発テスト１を維持する。Supabase Auth は使わない |
| 計算のテスト | FastAPI + SQLite + pytest | 予測・WBGT の回帰テストを Python のまま残す |
| 予報・再解析 | Open-Meteo | API キー不要。気温・湿度に加え風速・日射を取り、推定 WBGT に使う |
| 周回コース | 公開の徒歩ルート、Overpass、Open-Meteo 標高 | サーバだけが叩く。出発点付近の大通り、河川敷、公園内の道をたどり、時計回りに戻る周回を最大50件集めて上位5件を出す。出発点が公園の中、または細い道に面しているときは、園内の通路や細い道からは始めず、800m以内の大通りと河川敷を近い順に周回の起点にする。起点は5kmまでは最大5本で、5kmを超えて3km伸びるごとに1本減らし、17km以上はいちばん近い1本にする。起点が1本のときの追加探索も同じ刻みで減らし、17km以上は足さない。各起点では出発した向きの逆も探す。選んだ地点からその道までの距離はコースごとに表に出すが、点数には入れない。公園内の通路は、園内の半分以上を通っていれば走りやすい道として周回に入れる。概形は先に置かない。大通りだけで閉じないときは道の段階を一段ずつ下げ、候補が1本できるまで繰り返す。進む向きが5方向に満たなければ、別の方向も探す。表示は向きが重ならない候補を点数の高い順に最大5件。走りやすい道（30点）、直進（10点）、指定距離との差（20点）、曲がり角（10点。1kmあたり3回で0点）、細い道（10点）、道路重複（10点。10%超は除外）、時計回り（5点）、Uターン（5点）の順に採点する。配点の合計は100点。信号は採点しない。曲がってすぐ元の道へ戻る短い往復は、まっすぐな道に直す。除外は指定の±20%の外。出発点から周回までの同じ道は、その先で分かれて周回になるなら重複に数えない。合格が無いときは、距離が最も近い案と、距離は合って重複が多い案を1件ずつ表示する。画面は最大5件。地図の下の表に、距離・付近の道までの距離・評価・実スコアと内訳を出す。付近の道までの距離は点数に入れない。コース名のボタンで地図の線を切り替える。評価はその回の最高実スコアを100点にした相対評価で、実スコアは素点。カッコ内は実スコア。表の右上に採点基準を置く。予想ペースと予想タイムは出さない。検索中は進捗と合格件数をスピナーの下へ出し、「検索を中止」で止められる。保存しない（[#57](https://github.com/H-Inagawa/pacecast/issues/57)） |
| アメダス | 気象庁 bosai JSON | 地点マスタと、直近数日の気温・湿度・風 |
| 確認メール | Gmail SMTP（`smtp.gmail.com:587` / STARTTLS） | API キー不要。アプリパスワードを `.env` に置く |

## 2. 構成図

```
[Browser]  ローカル http://127.0.0.1:3000
           公開     https://….vercel.app
    |
    v
[Next.js / web]   ローカル、または Vercel（Root Directory = web）
    +-- app/            画面
    +-- app/api         認証・走行・設定・予測・気象
    +-- lib/server      予測・WBGT・アメダス・Open-Meteo
    |
    +-- smtp.gmail.com:587
    v
[Supabase PostgreSQL]
    +-- auth_users / email_verifications / password_resets
    +-- user_profiles / running_records
    +-- weather_observations（地点で共有）
```

pytest 用に `pacecast/`（FastAPI + SQLite）は残るが、画面は rewrite しない。Vercel には Python を載せない。

詳細は `frontend-nextjs.md`、`docs/06_dev/supabase-setup.md`、`docs/06_dev/vercel-setup.md` を参照。

## 3. ディレクトリ

```
web/                Next.js 画面と API
  app/api/          Route Handlers
  lib/server/       DB・予測・気象
pacecast/           pytest 用の API と業務ロジック
supabase/schema.sql Supabase へ貼る DDL
scripts/            SQLite → Supabase コピー
tests/
docs/
```

## 4. 起動時の動き

1. Next.js が画面と `/api` を提供する
2. 接続情報は `.env`（または `web/.env.local`、公開時は Vercel の Environment Variables）の `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY`
3. 走行の保存時に、アメダスと Open-Meteo から過去気象を取得する
4. 未ログインはログイン画面。開発テスト１は確認なしで入れる
