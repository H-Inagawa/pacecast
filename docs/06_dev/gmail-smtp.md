# 確認メール用 Gmail（人間側）

作成日: 2026-09-19  
根拠: [GitHub Issue #39](https://github.com/H-Inagawa/pacecast/issues/39)

新規登録の確認メールと、パスワード再設定メールは、Next.js が `smtp.gmail.com`（ポート 587、STARTTLS）へ送ります。送信用は **PaceCast 専用の Google アカウント** にします。私用 Gmail は使わないでください。アプリパスワードが `.env` や Vercel に残るため、私用ログインと混ぜると止めたり回したりしにくいです。

値はチャットや Issue に貼らない。`.env` は Git に載せません。

SMTP のユーザーとパスワードが空のときは、登録後に画面へ確認リンクが出ます。pytest / Vitest は実 SMTP に繋がりません。

## 1. 送信用アカウントを作る

1. ブラウザで [Google アカウントの作成](https://accounts.google.com/signup) を開く
2. 名前はアプリ用でよい（例: PaceCast Mail）
3. メールアドレスは **新しい Gmail を作る**（例: `pacecast.mail@gmail.com`）。既存の私用アドレスは選ばない
4. パスワードを決め、パスワードマネージャへ残す（あとからアプリパスワードとは別物）
5. 電話番号を求められたら、確認コードを受け取れる番号を入れる。Google が重複アカウントと見なさないための確認です
6. 復旧用メールは、専用アカウントをロックアウトしたとき用に、私用アドレスを入れてよい（**送信用には使わない**）
7. 利用規約に同意して作成する

作成後、そのアカウントで Gmail に一度ログインできることを確認します。

## 2. 2段階認証を有効にする

通常の Gmail ログインパスワードでは SMTP 送信できません。先に 2段階認証が必要です。

1. 専用アカウントでログインしたまま [2段階認証プロセス](https://myaccount.google.com/signinoptions/two-step-verification) を開く
2. **使いはじめる** を押し、SMS または認証アプリで有効にする
3. 画面に「2段階認証プロセスが有効です」と出るまで進める

## 3. アプリパスワードを発行する

1. 同じアカウントで [アプリパスワード](https://myaccount.google.com/apppasswords) を開く  
   「アプリパスワード」が出ないときは、2段階認証が未完了か、職場・学校の Google アカウントです。専用の個人 Gmail でやり直してください
2. アプリは「メール」、端末は「Windows パソコン」などで発行する
3. 16文字（4文字×4、空白入り）が出る。これを `PACECAST_SMTP_PASSWORD` にする
4. 発行画面を閉じると再表示できない。忘れると、同じページで破棄して作り直す

## 4. ローカルの `.env` に入れる

リポジトリ直下に `.env` が無ければ、`.env.example` をコピーします。

```powershell
Copy-Item .env.example .env
```

Next.js は `web/` から起動しても、親の `.env` を読みます。`web/.env` に同じキーを書いてもよいです。

| キー | 値 |
| --- | --- |
| `PACECAST_SMTP_HOST` | `smtp.gmail.com`（既定のままでよい） |
| `PACECAST_SMTP_PORT` | `587` |
| `PACECAST_SMTP_USER` | 手順1の専用 Gmail |
| `PACECAST_SMTP_FROM` | 同じアドレスでよい |
| `PACECAST_SMTP_PASSWORD` | 手順3のアプリパスワード（表示の空白はそのままでよい。送信時に除く） |
| `PACECAST_APP_ORIGIN` | ローカルは `http://127.0.0.1:3000` |

Supabase の URL と service_role も同じ `.env` に入れます（`docs/06_dev/supabase-setup.md`）。

`web/` で `npm run dev` を動かしているときは、一度止めて起動し直します。`.env` は起動時に読みます。

## 5. 送れたか見る

1. ブラウザで http://127.0.0.1:3000/register を開く
2. 受信確認できるメール（専用アカウントでも、別のテスト用でもよい）とパスワードを入れて登録する
3. 受信箱に「PaceCast のメール確認」が届く。リンクは 24 時間有効
4. リンクを開くと確認が終わり、ユーザー設定（名前・地点・誕生日）へ進む。保存するとメイン画面へ進む

パスワード再設定も同じ SMTP です。ログインの「再設定」から依頼し、件名は「PaceCast のパスワード再設定」。未登録メールでも画面の案内は同じです。SMTP 未設定のローカルでは、登録済みなら画面に再設定リンクが出ます。

届かないときは、迷惑メールと、`PACECAST_SMTP_PASSWORD` がログインパスワードではなくアプリパスワードかを見てください。エラー時は API が「Gmail のアプリパスワードと .env を確認してください」と返します。

開発テスト１（`dev@pacecast.local` / `pacecast-dev`）は登録なしで入れるので、SMTP は不要です。Cursor からの画面確認もこのアカウントです。私用メールでは確認しません。

## 6. Vercel（公開サイト）でも送るとき

ローカルの `.env` はデプロイに乗りません。Vercel の Environment Variables に、上と同じ `PACECAST_SMTP_*` を Production / Preview / Development へ入れます。

確認リンクの土台は `PACECAST_APP_ORIGIN` です。公開 URL（末尾スラッシュなし）を入れて Redeploy します。手順の残りは `docs/06_dev/vercel-setup.md` です。
