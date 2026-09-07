# PaceCast

過去のランニング記録と気象データから、指定条件での走行パフォーマンスを予測するアプリケーションです。

構想は `docs/00_concept/initial-request.md`、現行仕様は `AGENTS.md` を参照してください。

## 必要環境

- Python 3.11 以降
- Node.js 20 以降

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

ブラウザで http://127.0.0.1:3000 を開きます。初回の API 起動時、気象テーブルが空なら `data/weather/data.csv` を自動取り込みします。

## テスト

```bash
pytest
```
