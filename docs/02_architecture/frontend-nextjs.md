# フロントエンド移行方針（Next.js）

作成日: 2026-09-06  
更新日: 2026-09-20  
根拠: `docs/05_improvements/second-request.md`、[Issue #46](https://github.com/H-Inagawa/pacecast/issues/46)

## 1. 現状

MVP は FastAPI が Jinja2 で HTML を返し、画面と業務ロジックが同じプロセスにあった。その後 JSON API を FastAPI、画面を Next.js に分けた。#46 以降、画面の API は Next.js の Route Handlers が Supabase を直接読む。FastAPI は pytest 用に残す。

## 2. 責務分離

| 層 | 担当 | 置かないもの |
| --- | --- | --- |
| Next.js（`web/`） | 画面、JSON API、Supabase アクセス、気象取得・予測 | service_role をブラウザへ出すこと |
| FastAPI（`pacecast/`） | pytest 用の同等ロジックと SQLite | ブラウザ向け HTML / 本番 API |

ブラウザは Next.js（開発時はポート 3000）を開く。`/api/*` は Next.js が処理する。FastAPI へ rewrite しない。

## 3. API

- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/verify` / `GET /api/auth/me` / `POST /api/auth/forgot-password` / `POST /api/auth/reset-password`
- `GET /api/runs` / `GET /api/runs/{id}` / `POST /api/runs` / `PUT /api/runs/{id}` / `DELETE /api/runs/{id}`
- `GET /api/profile` / `PUT /api/profile`
- `GET /api/amedas/stations`
- `GET /api/forecast?station_id=`
- `POST /api/predict`

認証以外の `/api/*` はログイン必須。セッションは httpOnly Cookie（`pacecast_session`）。画面の `/login` `/register` `/verify` `/forgot-password` `/reset-password` 以外は未ログインならログインへ戻す。`GET /api/auth/me` は `email` / `display_name` / `needs_settings` を返す。ログイン中でユーザー名が空なら設定未完了として `/settings` へ戻す（クライアントは `window.location.replace`）。設定の保存ではユーザー名・アメダス地点・誕生日を必須にする。ヘッダに登録の3段階を出す。走行・設定・予測はそのセッションのユーザーだけを対象にする。確認メールとパスワード再設定メールは Next.js が `smtp.gmail.com` へ送る。SMTP 未設定なら登録 API が `verification_url`、再設定 API が `reset_url` を返し、画面にリンクを出す。未登録メールへの再設定依頼は、登録済みと同じ案内にする。

走行時間は DB 上は従来どおり `duration_sec`。API の入出力は時・分・秒に分解し、既存記録と互換を保つ。

## 4. ディレクトリ

```
web/                 Next.js App Router
  app/               画面（分析は `/analyze`）
  app/api/           Route Handlers
  components/        共通 UI
  lib/               API クライアントと表示整形
  lib/server/        Supabase・予測・気象（サーバのみ）
pacecast/
  routers/api.py     pytest 用 JSON API
  services/          pytest 用の業務ロジック
supabase/schema.sql  Postgres 定義
```

## 5. 起動

1. `docs/06_dev/supabase-setup.md` のとおりプロジェクトと `.env` を用意する
2. `npm run dev`（`web/`）
3. ブラウザは http://127.0.0.1:3000

pytest は SQLite と TestClient を使う（ポート 8000 の起動は不要）。公開は `docs/06_dev/vercel-setup.md`。

## 6. 自動テスト

根拠: [Issue #9](https://github.com/H-Inagawa/pacecast/issues/9)

| 層 | 道具 | 見るもの |
| --- | --- | --- |
| 計算（Python） | pytest | 紐付け、予測、WBGT、アメダス |
| 計算・API ヘルパ（TS） | Vitest | 回帰、日時、気象の最近傍 |
| 画面の入力と表示 | Vitest + Testing Library | 予測フォーム、地点の都道府県絞り込み、GPS 最寄り、記録追加の初期地点、日付・気象の整形 |

画面の主要操作（記録追加・予測・設定保存）は、まずコンポーネント／ページ単体で確認する。API とブラウザを同時に立てる E2E は、画面単体では足りない操作が出てから足す。

処理待ちは `LoadingOverlay` で出す。`apiGet` / `apiSend` とサイト内リンクの遷移を数える。150ms 未満の待ちは出さない。

色は `web/app/globals.css` の CSS 変数。ライトは `:root`、ダークは `@media (prefers-color-scheme: dark)`。設定での切替はまだ無い。

```bash
cd web
npm test
```

## 7. 拡張

画面追加は `web/app` にルートを足す。予測手法を変えて API に RMSE / R² / 関係グラフを足すときは、予測画面も一緒に直す。
