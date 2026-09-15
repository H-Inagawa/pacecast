# Next.js が Supabase を直接叩く判断

作成日: 2026-09-15  
根拠: [GitHub Issue #46](https://github.com/H-Inagawa/pacecast/issues/46)

| 項目 | 判断 | 理由 |
| --- | --- | --- |
| 順序 | #46 を #45（Vercel）より先にする | SQLite のままでは公開先で履歴が残らない |
| 接続 | Next.js の Route Handlers（`web/app/api`）が service_role で Postgres を読む | 画面と API を同じプロセスに閉じ、Vercel に載せやすい |
| FastAPI | リポジトリに残す。画面の rewrite は外す | Python の pytest（予測・WBGT）は維持する |
| 認証 | 従来の PBKDF2 + Cookie。Supabase Auth は使わない | 既存の確認メール（Gmail SMTP）と開発テスト１を壊さない |
| RLS | 有効。anon / authenticated にはポリシーを付けない | ブラウザから直叩きできない。サーバだけが service_role で読む |
| 日時 | 保存は timestamptz（東京 +09:00） | Vercel の UTC でも走行時刻がずれない |
| 既存データ | `scripts/migrate_sqlite_to_supabase.py` で任意コピー | 空のプロジェクトへ一度だけ |
