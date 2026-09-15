# Vercel へ画面と API を載せる判断

作成日: 2026-09-16  
根拠: [GitHub Issue #45](https://github.com/H-Inagawa/pacecast/issues/45)

| 項目 | 判断 | 理由 |
| --- | --- | --- |
| ホスト | Vercel Hobby。Root Directory は `web` | Next.js の標準。Python / SQLite は載せない |
| ドメイン | `*.vercel.app`。買わない | Issue での確認。独自ドメインは後でよい |
| リージョン | `hnd1`（東京） | 利用者と Supabase Tokyo に近い |
| 環境変数 | Vercel 側に `SUPABASE_*` と `PACECAST_SECRET` など | ローカルの `.env` はデプロイに乗らない |
| セッション署名 | 本番ではローカル既定値を拒否 | 公開 URL で既定秘密を使わない |
| 確認メール origin | `PACECAST_APP_ORIGIN`。未設定時は `VERCEL_URL` | 確認リンクが公開 URL を指すようにする |
| 自動デプロイ | GitHub 連携の既定。本番ブランチはいま公開したい `develop/v0.x`（現在は `v0.2`）。区切りで番号を上げる運用は可 | Issue の完了条件 |
