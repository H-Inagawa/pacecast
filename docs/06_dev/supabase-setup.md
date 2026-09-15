# Supabase の用意（人間側）

作成日: 2026-09-15  
根拠: [GitHub Issue #46](https://github.com/H-Inagawa/pacecast/issues/46)

画面（Next.js）が service_role で PostgreSQL を直接読む。Supabase Auth は使わない。ログインは従来どおりメール＋パスワードと Cookie `pacecast_session`。

## 1. プロジェクトを作る

1. [https://supabase.com](https://supabase.com) でアカウントを作る（GitHub ログイン可）
2. **New project** を選ぶ
3. Organization を選ぶ（無ければ作る）
4. Project name は `pacecast` でよい
5. Database password を決めて、パスワードマネージャへ残す（あとから再表示できない）
6. Region は **Northeast Asia (Tokyo)** を選ぶ
7. 作成完了まで待つ（1〜2 分）

Free プランでよい。

## 2. 接続情報を控える

左メニュー **Project Settings → API**。

| 画面の項目 | 環境変数 |
| --- | --- |
| Project URL（`https://xxxx.supabase.co`） | `SUPABASE_URL` |
| `service_role`（secret） | `SUPABASE_SERVICE_ROLE_KEY` |

`anon` `public` キーは使わない。`service_role` はデータベースをバイパスできる秘密キーなので、Git にもブラウザの JavaScript にも載せない。

## 3. テーブルを作る

1. 左メニュー **SQL Editor → New query**
2. リポジトリの `supabase/schema.sql` を全部貼る
3. **Run** する
4. エラーが無く、`auth_users` などのテーブルが **Table Editor** に出れば成功

同じ SQL を二度流してもよい（`if not exists`）。

## 4. 環境変数を入れる

リポジトリ直下の `.env.example` を `.env` にコピーし、次を埋める。

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=（service_role の値）
```

確認メール用の `PACECAST_SMTP_*` は、これまでどおりでよい。Next.js は `web/` から起動しても親の `.env` を読む。

`web/.env.local` に同じキーを書いてもよい。Git には載せない。

## 5. 既存の SQLite を移す（任意）

ローカルの `data/pacecast.db` をクラウドへコピーするときだけ。空のプロジェクトへ一度だけ行う。すでにデータがあるテーブルへ重ねると重複エラーになる。

```powershell
python scripts/migrate_sqlite_to_supabase.py
```

成功すると件数を出す。開発テスト１（`dev@pacecast.local`）も SQLite にあればコピーされる。無いときは、画面から同じパスワードでログインするとクラウド側に作られる。

## 6. 画面を起動する

FastAPI（ポート 8000）は画面には不要。Python の pytest を回すときだけ使う。

```powershell
cd web
npm install
npm run dev
```

ブラウザは http://127.0.0.1:3000 。

- メール: `dev@pacecast.local`
- パスワード: `pacecast-dev`

走行の追加・一覧・予測・設定が動けば、本 Issue の確認は足りる。接続設定が無いときは API が 503 で、Supabase の URL と service_role を促す。

## 7. やってはいけないこと

- `service_role` を Issue・チャット・Git に貼る
- ブラウザから見える `NEXT_PUBLIC_*` に service_role を置く
- この作業の確認を私用 Gmail で行う（開発テスト１を使う）

Vercel への公開は [#45](https://github.com/H-Inagawa/pacecast/issues/45)。手順は `docs/06_dev/vercel-setup.md`。環境変数は Vercel 側にも入れる。
