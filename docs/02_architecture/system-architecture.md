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
| 周回コース | 公開の徒歩ルート、Overpass、Open-Meteo 標高 | サーバだけが叩く。時計回り・長方形・正方形（道の向きと右45度、南北に長い長方形）を、その回は無作為な形から探す。概形は指定距離の80%。曲がり角（34点）、設定距離との差（26点）、道路重複（20点）、直進（12点）、信号（8点）の順に採点する。曲がりは1kmあたり1か所以下で満点、5回で0点。道路重複は20%で0点。信号は1kmあたり5基で0点。大通りと交差点は点数に入れない。信号は、曲がって渡るものと、信号のある交差点で道路を横断するものを数える。5kmまでは距離の満点が±20%かつ±2km、除外が±50%かつ±5km。指定が5kmから3km増えるごとに、距離の採点のきつさを5点下げる（26点から、5点が下限）。合格が打ち切り件数未満で、その周の距離の中央値が満点の外なら図形の大きさを2%ずつ、最大10回まで変える。打ち切りは5kmまで25件で、3km増えるごとに5件減らし、5件が下限。達したら探索も調整も止める。画面は最大5件。地図の下の表に、距離・評価・実スコアと内訳を出す。コース名のボタンで地図の線を切り替える。評価はその回の最高実スコアを100点にした相対評価で、実スコアは素点。カッコ内は実スコア。表の右上に採点基準を置く。予想ペースと予想タイムは出さない。検索中は進捗と合格件数をスピナーの下へ出す。保存しない（[#57](https://github.com/H-Inagawa/pacecast/issues/57)） |
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
