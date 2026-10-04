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
| 周回コース | Overpass（OSM）、Open-Meteo 標高 | サーバだけが叩く。歩道・歩道付き道路・歩行者／自転車通行可・公園内通路・河川敷経路のネットワークをたどり、同じ向きの曲がりを優先し、公園の縁や堀・河川沿いの道はごく弱く優遇し、出発直後は分岐を絞り込まず探し（距離が長いほどその区間を短くする。基準は約800m）て、時計回りに戻る周回を距離に応じた上限（長いほど少なく。最大50件）まで集め、打ち切り件数に達したら探索をやめて上位5件を出す。幹線道路本体は歩道タグが無い限り採用しない。独立した専用歩道（`highway=footway` かつ `footway=sidewalk`）はルートに使わず、それと並ぶ歩道タグのない車道を走りやすい道として扱う。少し行ってすぐ戻る短い突き出しや車線乗り換えのような短い折れはまっすぐな道に直す。走りやすい道だけで閉じないときは生活道路などの歩行可能な接続道路を足す（長い利用は細い道の点数で下げる）。直前の道を180度引き返すUターンはしない。同じ道を周回のあとで再利用して戻るのは許す。スタートは、面している細い道や公園内の通路を含む、いちばん近い走りやすい道または接続道路から始める。広場や山奥など、近くにスタートできる道が無いときは、理由と起点の移動案内を出す。追加探索は距離が長いほど減らし、17km以上は足さない。出発した向きの逆も探す。公園内の通路は、園内の半分以上を通っていれば走りやすい道として周回に入れる。概形は先に置かない。表示は向きが重ならない候補を点数の高い順に最大5件。指定距離との差（20点）、走りやすい道の割合（20点）、細い道の短さ（20点。25%で0点、40%超は除外）、直進（10点）、信号（10点。実距離1kmあたり5回で0点。`crossing=traffic_signals` など）、曲がり角（10点。1kmあたり3か所で0点）、道路重複（10点。10%超は除外）の順に採点する。配点の合計は100点。時計回り・Uターンは採点・表示しない。曲がってすぐ元の道へ戻る短い往復は、まっすぐな道に直す。除外は指定の±20%の外。出発点から周回までの同じ道は、その先で分かれて周回になるなら重複に数えない。合格が無いときは、距離が最も近い案と、距離は合って重複が多い案を1件ずつ表示し、起点周辺の走りやすい道を細い青線で示して起点の移動を案内する。通常の結果では走りやすい道の青線は出さない。計画中・建設中・廃止・撤去・未使用の道路（`highway=proposed` / `construction` / `abandoned` / `razed` / `disused`）は検索から除外する。画面は最大5件。地図の下の表に、おすすめ度・スコア・距離と内訳を出す。コース名のボタンで地図の線を切り替える。評価はその回の最高実スコアを100点にした相対評価で、実スコアは素点。カッコ内は実スコア。表の右上に採点基準を置く。予想ペースと予想タイムは出さない。検索中は進捗と合格件数をスピナーの下へ出し、「検索を中止」で止められる。保存しない（[#57](https://github.com/H-Inagawa/pacecast/issues/57) / [#60](https://github.com/H-Inagawa/pacecast/issues/60)） |
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
