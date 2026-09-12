# PaceCast

過去のランニング記録と気象データから、指定条件での走行パフォーマンスを予測するアプリケーションです。

構想は `docs/00_concept/initial-request.md`、現行仕様は `AGENTS.md` を参照してください。

別の PC で clone したあとの手順（GitHub CLI のログイン、DB の扱い、Git の進め方）は `docs/06_dev/team-setup.md` です。

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

API と画面を別プロセスで起動します。

```bash
uvicorn pacecast.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd web
npm run dev
```

ブラウザで http://127.0.0.1:3000 を開きます。過去気象は走行の保存時に、アメダスと Open-Meteo から自動取得します。

## 停止

使い終わったら、API（8000）と画面（3000）の各ターミナルで `Ctrl+C` を押します。ターミナルを閉じるだけでは、プロセスが残ることがあります。

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
