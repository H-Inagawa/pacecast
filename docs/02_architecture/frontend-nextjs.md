# フロントエンド移行方針（Next.js）

作成日: 2026-09-06  
根拠: `docs/05_improvements/second-request.md`

## 1. 現状

MVP は FastAPI が Jinja2 で HTML を返し、画面と業務ロジックが同じプロセスにあった。学習初期の一周には向いていたが、画面改善と今後の画面追加を続けるとテンプレートが肥大しやすい。

## 2. 責務分離

| 層 | 担当 | 置かないもの |
| --- | --- | --- |
| Next.js（`web/`） | 画面、入力制御、一覧の月別整形、ツールチップ | 予測計算、DB アクセス |
| FastAPI（`pacecast/`） | JSON API、SQLite、気象取得・紐付け・予測 | 見た目のレイアウト |

ブラウザは Next.js（開発時はポート 3000）を開く。API は FastAPI（ポート 8000）。開発中は Next.js の rewrite で `/api/*` を FastAPI に転送する。

## 3. API

- `GET /api/runs` / `GET /api/runs/{id}` / `POST /api/runs` / `PUT /api/runs/{id}` / `DELETE /api/runs/{id}`
- `GET /api/profile` / `PUT /api/profile`
- `GET /api/amedas/stations`
- `GET /api/intensities` 走行強度の定義
- `POST /api/predict`

走行時間は DB 上は従来どおり `duration_sec`。API の入出力は時・分・秒に分解し、既存記録と互換を保つ。

## 4. ディレクトリ

```
web/                 Next.js App Router
  app/               画面（分析は `/analyze`）
  components/        共通 UI
  lib/               API クライアントと表示整形
pacecast/
  routers/api.py     JSON API
  services/          業務ロジック（変更をここに閉じる）
```

## 5. 起動

1. `uvicorn pacecast.main:app --reload --host 127.0.0.1 --port 8000`
2. `npm run dev`（`web/`）
3. ブラウザは http://127.0.0.1:3000

## 6. 自動テスト

根拠: [Issue #9](https://github.com/H-Inagawa/pacecast/issues/9)

| 層 | 道具 | 見るもの |
| --- | --- | --- |
| API・計算 | pytest | 紐付け、予測、WBGT、アメダス |
| 画面の入力と表示 | Vitest + Testing Library | 予測フォーム、地点選択、日付・気象の整形 |

画面の主要操作（記録追加・予測・設定保存）は、まずコンポーネント／ページ単体で確認する。API とブラウザを同時に立てる E2E は、画面単体では足りない操作が出てから足す。

処理待ちは `LoadingOverlay` で出す。`apiGet` / `apiSend` とサイト内リンクの遷移を数える。150ms 未満の待ちは出さない。

```bash
cd web
npm test
```

## 7. 拡張

画面追加は `web/app` にルートを足す。予測手法の変更は `pacecast/services` だけを変え、API の形が同じならフロントは触らない。
