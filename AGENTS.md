# PaceCast 仕様（エージェント向け）

このファイルは、実装・修正時に参照する現行仕様です。構想の原文は `docs/00_concept/initial-request.md`、判断経緯は `docs/` 配下を参照してください。

## 目的

過去のランニング記録と気象データから、指定した気象条件・走行強度における走行ペース・タイムを予測する。

## 技術構成

- 言語: Python 3.11+
- API: FastAPI（`http://127.0.0.1:8000`）
- 画面: Next.js App Router（`web/`、`http://127.0.0.1:3000`）。画面テストは Vitest（`web/` で `npm test`）
- DB: SQLite（`data/pacecast.db`）
- ORM: SQLAlchemy 2.0
- 天気予報: Open-Meteo（API キー不要）。地点は設定のアメダス観測所（未設定時は東京 44132）。テスト用の既存設定は練馬（44071）のまま
- 過去気象: Open-Meteo 再解析。直近数日の気温・湿度・風はアメダス map JSON も使う。手動 CSV は使わない

画面は FastAPI で HTML を返さない。ブラウザは Next.js を開く。

## 画面の方針

- ヘッダ左にドロワーメニュー。今いる画面は強調して選べない。ロゴはホーム。ヘッダはスクロールしても画面上部に固定
- ホームに大きな「走行記録」「パフォーマンスを予測」と、小さめの「PaceCastとは？」「分析結果を見る」。設定はヘッダ右上の歯車
- 「PaceCastとは？」は半透明モーダル。概要・各画面・出典・バージョン・ライセンス（本体は未定）を出す
- ホームに最近の走行は出さない。記録の閲覧・追加・編集は走行記録画面
- 「記録を追加」「編集」は半透明モーダル。削除時は「記録を削除してよろしいですか？」で確認する
- 走行記録は月別。新しい月が上。各行にペースと、紐付いた気象（例: `21.0℃ / 60% / WBGT 19.9`）を出す。未関連は `--.-℃ / --%`。気象列ヘッダに WBGT の説明アイコンを付ける
- 走行記録の見出し右と各月に `走行件数：XX件 走行距離：XXX.XXkm` を出す（件数・距離のフォントは同じ）
- 走行時間は時（0〜23）・分・秒のセレクト
- 走行距離の表示は小数第2位
- 日時の表示は `YYYY-MM-DD HH:mm`（24時間・ハイフン）。カレンダー入力（date / datetime-local）はブラウザ表示のスラッシュを許容する
- 予測の気象指定は、選んでいない方式の入力を disabled にする（非表示にしない）。距離指定も同じ
- 予測結果はペースとタイム。予想平均心拍は出さない（強度の目標 bpm は入力条件・類似走の重み付けに使う）
- 走行記録・予測・設定・分析の「ホームへ戻る」は画面下部に固定し、白抜きの緑ボタンにする
- 下部の主要ボタンとホーム戻りは高さを揃え、横幅は 3:1 で画面幅いっぱい。本文も画面幅を使う

## 業務ルール

- 地点は設定のアメダス観測所。未設定時は東京（44132）。走行追加と予報では地点を選べる（既定は設定値）。既存テストデータは練馬（44071）
- 気象との紐付けは走行開始時刻の最近傍1時間値。同距離なら早い方を採用する。許容差は 90 分
- 予測・グラフなど気象を使う計算からは、未関連の走と、推定 WBGT が無い走を除外する
- ペースは `duration_sec / distance_km`（秒/km）。DB の時間は秒のまま保持する
- 予測は気象距離と心拍距離の加重平均。目標 bpm は設定の強度別心拍（最大心拍からの算出＋個別上書き可）
- 最大心拍の年齢式は `220 - 満年齢`。色分けは最大心拍比 70% / 80% 境界。未設定または設定オフなら白
- 気象距離: 重み付けは `|推定WBGT差|`。根拠表の表示は予測対象との差（過去走が高いと `+`、低いと `-`）。式は小野・登内 (2014) / 環境省実況推定
- 推定 WBGT は気象行に保存する。入力の風速・日射も残す。式の版は `wbgt_method=ono2014`
- 平均心拍数は記録時は任意。予測時、心拍が無い走はペナルティ付きで使う
- 気象の再取得は `(observed_at, station_id)` で upsert する

## ドキュメント

| 資料 | 内容 |
| --- | --- |
| `docs/00_concept/initial-request.md` | 初期構想 |
| `docs/05_improvements/second-request.md` | MVP 後の改善要望 |
| `docs/05_improvements/settings-and-heart-rate.md` | 設定・最大心拍・強度ゾーン |
| `docs/05_improvements/layout-and-run-modal.md` | ヘッダ固定・記録追加モーダル・距離表示 |
| `docs/01_requirements/requirements.md` | 要件定義 |
| `docs/01_requirements/open-questions.md` | 未決事項 |
| `docs/02_architecture/system-architecture.md` | システム構成 |
| `docs/02_architecture/frontend-nextjs.md` | フロント移行方針と画面テスト |
| `docs/02_architecture/intensity-prediction.md` | 強度付き予測 |
| `docs/02_architecture/decisions-2026-09-06.md` | 改善時の判断 |
| `docs/02_architecture/decisions-2026-09-08.md` | 予想平均心拍を結果に出さない判断 |
| `docs/02_architecture/date-display.md` | 日時表示の共通規則 |
| `docs/02_architecture/wbgt.md` | 推定 WBGT とアメダス地点 |
| `docs/02_architecture/decisions-2026-09-12.md` | WBGT 導入時の判断 |
| `docs/03_database/database-design.md` | DB 設計 |

## 開発時の約束

- Python メソッドの docstring は、説明・引数・戻り値を日本語で書く
- 仕様判断を変えたら、このファイルと該当ドキュメントを更新する
- GitHub Issues（[#31](https://github.com/H-Inagawa/pacecast/issues/31)）
  - 登録・コメントの冒頭に `【Cursor自動入力】` を付ける
  - Issue は close しない。終了は開発者がプッシュ後に行う
