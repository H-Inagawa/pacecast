# PaceCast

過去のランニング記録と気象データから、指定条件での走行パフォーマンスを予測するアプリケーションです。

構想は `docs/00_concept/initial-request.md`、現行仕様は `AGENTS.md` を参照してください。

別の PC で clone したあとの手順（GitHub CLI のログイン、DB の扱い、Git の進め方）は `docs/06_dev/team-setup.md` です。公開（Vercel）は `docs/06_dev/vercel-setup.md` です。

## 必要環境

- Python 3.11 以降
- Node.js 20 以降
- GitHub CLI（`gh`）。入れ方は `docs/06_dev/team-setup.md`

## セットアップ

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
cd web
npm install
```

## 起動

データベースは Supabase です。プロジェクトの作り方は `docs/06_dev/supabase-setup.md` です。画面は Next.js だけ起動します。

```bash
cd web
npm run dev
```

ブラウザで http://127.0.0.1:3000 を開きます。ログインはメールとパスワードです。開発確認アカウントは `docs/06_dev/team-setup.md` です。新規登録の確認メールは専用 Gmail から送ります（`docs/06_dev/gmail-smtp.md`）。`.env.example` を `.env` にコピーし、Supabase の URL・service_role と送信用のアプリパスワードを入れてください。SMTP 未設定のときは登録後に画面へ確認リンクが出ます。過去気象は走行の保存時に、アメダスと Open-Meteo から自動取得します。

FastAPI（ポート 8000）は pytest 用です。画面確認には不要です。

画面が開かないときは、ポートが Listen でも応答していないことがあります。次で確認します。`000` やタイムアウトならハングなので、下の停止手順で落としてから `npm run dev` し直します。

```powershell
curl.exe -sS -o NUL -w "%{http_code}\n" --max-time 8 http://127.0.0.1:3000/
```

## 停止

使い終わったら、画面（3000）のターミナルで `Ctrl+C` を押します。ターミナルを閉じるだけでは、プロセスが残ることがあります。

ポートが使用中のまま（`EADDRINUSE`）で再起動できないときは、PowerShell で次を実行して強制終了します。

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## テスト

```bash
pytest
cd web
npm test
```
