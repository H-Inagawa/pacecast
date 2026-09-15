# Vercel への公開（人間側）

作成日: 2026-09-16  
根拠: [GitHub Issue #45](https://github.com/H-Inagawa/pacecast/issues/45)

画面と API は Next.js（`web/`）。データは既存の Supabase。ドメインを買う必要はなく、Vercel が `*.vercel.app` を無料で出します。Hobby（無料）で足ります。

Python / FastAPI は載せません。pytest 用のままローカルだけです。

## 0. 先にコードを GitHub へ載せる

Vercel は GitHub の内容をビルドします。#46 の Next.js API と、この公開用の設定が入ったコミットを **push してから** 連携してください。まだ push していなければ、先に commit / push します。

いまの作業ブランチは `develop/v0.2` です。Vercel の Production Branch も、公開したいブランチに合わせます（方針は下の「6. GitHub への push で自動デプロイ」）。

## 1. アカウントを作る

1. [https://vercel.com/signup](https://vercel.com/signup)
2. **Continue with GitHub** で、PaceCast のリポジトリがある GitHub アカウントを使う
3. リポジトリへのアクセスを許可する（All repositories でも、`H-Inagawa/pacecast` だけでもよい）

## 2. プロジェクトを取り込む

1. [https://vercel.com/new](https://vercel.com/new)
2. `pacecast` を **Import**
3. 次を設定する（ここを外すとルートの Python を見に行って失敗する）

| 項目 | 値 |
| --- | --- |
| Framework Preset | Next.js（自動検出） |
| Root Directory | `web`（Edit を開いて選ぶ） |
| Build Command | `npm run build`（既定のまま） |
| Install Command | `npm install`（既定のまま） |
| Node.js Version | 20.x |

4. まだ Deploy しない。先に環境変数を入れる（**Environment Variables** を開く）

## 3. 環境変数を入れる

Production / Preview / Development の **3つすべて** に入れる。値はローカルの `.env` と同じでよいものが多いです。`service_role` はチャットや Issue に貼らない。

セッション署名はローカル既定値 `pacecast-local-secret` では本番が動きません。PowerShell で作ります。

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

出た文字列を `PACECAST_SECRET` に入れる。

| キー | 内容 |
| --- | --- |
| `SUPABASE_URL` | ローカル `.env` と同じ |
| `SUPABASE_SERVICE_ROLE_KEY` | ローカル `.env` と同じ（secret） |
| `PACECAST_SECRET` | 上で作ったランダム文字列 |
| `PACECAST_SMTP_HOST` | `smtp.gmail.com`（確認メールを使うとき） |
| `PACECAST_SMTP_PORT` | `587` |
| `PACECAST_SMTP_USER` | 送信用 Gmail |
| `PACECAST_SMTP_PASSWORD` | Gmail のアプリパスワード |
| `PACECAST_SMTP_FROM` | 送信元アドレス |
| `PACECAST_APP_ORIGIN` | 最初は空でよい。デプロイ後の URL を入れて再デプロイ |

`NEXT_PUBLIC_*` は作らない。`anon` キーも入れない。

## 4. デプロイする

1. **Deploy**
2. ビルドが緑になるまで待つ（初回は 1〜2 分）
3. 発行された URL（例: `https://pacecast-xxxx.vercel.app`）を控える
4. Settings → Environment Variables で `PACECAST_APP_ORIGIN` にその URL（末尾スラッシュなし）を入れる
5. Deployments から最新を **Redeploy**（環境変数をビルドに載せる）

確認メールのリンクはこの origin を使います。未設定でも Vercel が付ける `VERCEL_URL` にフォールバックしますが、本番 URL を明示した方が安定です。

## 5. 動作確認

ブラウザで発行 URL を開き、開発テスト１で入る。

- メール: `dev@pacecast.local`
- パスワード: `pacecast-dev`

ローカルと同じ Supabase なので、移した走行が一覧に出るはずです。Cursor からの確認もこのアカウントだけを使う。私用 Gmail では確認しない。

見るもの:

1. ログインできる
2. 走行記録が一覧できる
3. 記録の追加（気象が付く）
4. 予測が返る
5. 設定が保存できる
6. 別の PC やスマホのブラウザから同じ URL で開ける

ログインできないときは、Root Directory が `web` か、`PACECAST_SECRET` と `SUPABASE_*` が入っているかを見る。Vercel の **Deployments → 失敗したビルド・Runtime Logs** に詳細が出ます。

## 6. GitHub への push で自動デプロイ

GitHub 連携時の既定です。追加作業は不要です。プロジェクトは 1 つのまま、ブランチを `v0.3` に増やしても Vercel を作り直す必要はありません。

- Production Branch への push → 本番 URL（いつも同じ `*.vercel.app`）が更新される
- それ以外のブランチや PR → Preview URL（別ホスト。確認用）

**いまの公開（#45）** では Production Branch を `develop/v0.2` にしてください。Settings → Git。既定の `master` のままだと、いまの作業が本番に出ません。

区切りで `develop/v0.3` へ進むとき、Vercel 上でまずいのはブランチ名そのものではなく、**Production Branch を古い名前のままにすること**です。次のどちらかにします。

| やり方 | 本番に出るもの | `v0.3` に進むとき |
| --- | --- | --- |
| A. 本番 = いまの develop（推奨・今） | 作業中の最新 | Vercel の Production Branch を `develop/v0.3` に書き換える |
| B. 本番 = `master` | 区切りとしてマージした安定版 | Vercel の設定は触らない。`v0.2` を `master` へマージしたときだけ本番が更新される |

A を続けるなら、新しい `develop/v0.x` を切ったあと、Vercel の Production Branch を忘れず移す。移すまでは本番 URL は前のブランチの最後のデプロイのままです。Preview は新しいブランチへの push で自動的に出ます。

## 7. やってはいけないこと

- `service_role` と `PACECAST_SECRET` を Issue・チャット・Git に貼る
- ブラウザ向けの `NEXT_PUBLIC_*` に秘密を置く
- 独自ドメインを急いで買う（不要。`*.vercel.app` で足りる）
- 確認を私用 Gmail で行う

## ローカルとの違い

| 項目 | ローカル | Vercel |
| --- | --- | --- |
| 画面 | `http://127.0.0.1:3000` | `https://….vercel.app` |
| 環境変数 | リポジトリ直下の `.env` | Vercel の Environment Variables |
| DB | 同じ Supabase | 同じ Supabase |
| セッション Cookie | `secure` なし | HTTPS なので `secure` |
| FastAPI | pytest 用に任意 | 載せない |
| 初回アクセス | すぐ | Hobby はスリープ後に数秒かかることがある |
