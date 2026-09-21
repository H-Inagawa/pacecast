# PaceCast 仕様（エージェント向け）

このファイルは、実装・修正時に参照する現行仕様です。構想の原文は `docs/00_concept/initial-request.md`、判断経緯は `docs/` 配下を参照してください。

## 目的

過去のランニング記録と気象データから、指定した気象条件・走行強度における走行ペース・タイムを予測する。

## 技術構成

- 言語: TypeScript（画面と API）と Python 3.11+（pytest 用の計算コード）
- 画面と API: Next.js App Router（`web/`、`http://127.0.0.1:3000`）。JSON API は `web/app/api`。画面テストは Vitest（`web/` で `npm test`）
- DB: Supabase PostgreSQL。接続はサーバだけが `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` で行う。手順は `docs/06_dev/supabase-setup.md`
- 公開: Vercel（`web/` が Root Directory）。手順は `docs/06_dev/vercel-setup.md`。独自ドメインは買わない
- FastAPI（`pacecast/`、`http://127.0.0.1:8000`）と SQLite（`data/pacecast.db`）はローカルの pytest 用に残す。ブラウザは Next.js だけを開く
- 天気予報: Open-Meteo（API キー不要）。地点は設定のアメダス観測所（未設定時は東京 44132）。テスト用の既存設定は練馬（44071）のまま
- 過去気象: Open-Meteo 再解析。直近数日の気温・湿度・風はアメダス map JSON も使う。手動 CSV は使わない

画面は FastAPI で HTML を返さない。ブラウザは Next.js を開く。

## 画面の方針

- 日本語のフォントは Kaisei Opti。本文 Regular、ラベルと下部バーは Medium、見出しとロゴ PaceCast は Bold（Black / Italic は使わない）
- ヘッダは高さ 70px。左にドロワー（70px）、中央にロゴ（下に「○○ さん」）、右に設定（70px）。今いる画面は強調して選べない。ロゴはホーム。ヘッダはスクロールしても画面上部に固定
- ホームに大きな「走行記録」「パフォーマンスを予測」と、小さめの「PaceCastとは？」「分析結果を見る」。設定はヘッダ右上の歯車
- 「PaceCastとは？」は半透明モーダル。概要・各画面・出典・バージョン・ライセンス（本体は未定）を出す
- ホームに最近の走行は出さない。記録の閲覧・追加・編集は走行記録画面
- 「記録を追加」「編集」は半透明モーダル。削除時は「記録を削除してよろしいですか？」で確認する
- 走行記録は月別。新しい月が上。各行にペースと、気象は気温・湿度・WBGTを別列で出す。未関連は `--.-℃` / `--%` / `--.-`。WBGT列ヘッダに説明アイコンを付ける
- 走行記録の見出し右と各月に `走行件数：XX件 走行距離：XXX.XXkm` を出す（件数・距離のフォントは同じ）
- 走行時間は時（0〜23）・分・秒のセレクト
- 走行距離の表示は小数第2位
- 日時の表示は `YYYY-MM-DD HH:mm`（24時間・ハイフン）。カレンダー入力（date / datetime-local）はブラウザ表示のスラッシュを許容する
- 予測の気象指定は、選んでいない方式の入力を disabled にする（非表示にしない）。距離指定も同じ
- 予測結果はペースとタイム。RMSE（秒/km）と R²、関係グラフも出す。予想平均心拍は出さない（強度の目標 bpm は式の心拍項に使う）
- 予測タイトルの右に「予測の見方」。方法と RMSE / R² の基準をモーダルで出す
- 走行記録・予測・設定・分析の「ホームへ戻る」は画面下部に固定し、白抜きの緑ボタンにする
- 色は OS のダーク設定（`prefers-color-scheme`）に合わせる。トークンは [#18](https://github.com/H-Inagawa/pacecast/issues/18) の現行ライト／現行ダーク（仮）。設定画面での切替はまだ無い。ホームなど未デザインの画面は、レイアウトはそのままで色だけ追従する
- 半透明モーダルの閉じる操作は右上の「×」（`aria-label` は「閉じる」）。背景クリックと Escape も従来どおり
- 下部の主要ボタンとホーム戻りは高さ 50px で揃え、バー全体は 60px。横幅は 3:1 で画面幅いっぱい。走行記録だけ「表示項目設定」「記録を追加」「ホームへ戻る」を 1:3:1。本文も画面幅を使う
- 走行記録の列は「表示項目設定」で選べる。日時と距離は必ず出す。気象は気温・湿度・WBGTを個別に選ぶ。選択は端末に残す
- 画面遷移と API 通信の待ち中は、半透明のローディングスピナーを出す（ごく短い待ちは出さない）
- 未ログインはログイン画面。メール＋パスワード。パスワードを忘れたときはログインから再設定を依頼し、登録済みメールへ期限付きリンクを送る（確認メールと同じ SMTP）。未登録メールでも同じ案内にする。新規登録は Gmail SMTP（`smtp.gmail.com` / 587 / STARTTLS）で確認リンクを送る。送信用は PaceCast 専用アカウント（私用 Gmail は使わない）。認証はアプリパスワード。手順は `docs/06_dev/gmail-smtp.md`。設定はリポジトリ直下の `.env`（`.env.example` をコピー）。未設定時は画面に確認・再設定リンクを出す。メール確認のあと、ログイン中でユーザー名（`display_name`）が空なら設定未完了として `/settings` へ戻す。設定の保存ではユーザー名・アメダス地点・誕生日を必須にする。ヘッダに「メールアドレス入力 ⇒ メール確認 ⇒ ユーザー設定入力」を出す。開発者は `dev@pacecast.local` / `pacecast-dev`（開発テスト１）で登録なしに進めるが、ログイン画面にはアカウント情報を出さない。ドロワーからログアウトする

## 業務ルール

- 地点は設定のアメダス観測所。未設定時は東京（44132）。走行追加と予報では地点を選べる。記録追加の初期地点は設定で「設定どおり」か「GPS 最寄り」を選ぶ（許可が取れない・測位できないときは設定地点）。手動選択は都道府県で絞り、一覧は観測所番号順。設定では「GPSで探す」で現在地の最寄り観測所を入れられる（HTTPS または `http://127.0.0.1`）。既存テストデータは練馬（44071）
- 気象との紐付けは走行開始時刻の最近傍1時間値。同距離なら早い方を採用する。許容差は 90 分。1時間を超える走は開始と終了の2点を平均し、気温・湿度・風・日射の平均から推定 WBGT を付け直す。1時間以下、または隣の1時間値までの差は従来の1点。未関連は開始側が取れないとき（終了だけ取れても未関連のまま）
- 予測・グラフなど気象を使う計算からは、未関連の走と、推定 WBGT が無い走を除外する
- ペースは `duration_sec / distance_km`（秒/km）。DB の時間は秒のまま保持する
- 予測は推定 WBGT・距離・心拍の式モデル（直近ほど重い重み付き最小二乗。交差・2次は件数に応じて）。計算は km/h、表示は秒/km。目標 bpm は設定の強度別心拍（最大心拍からの算出＋個別上書き可）。記録から大きく外れた距離・心拍は外れやすい（改善は [#44](https://github.com/H-Inagawa/pacecast/issues/44)、今は実装しない）
- 最大心拍の年齢式は `220 - 満年齢`。走行記録の色分けは設定で心拍 / 気象（WBGT） / しない。心拍は最大心拍比 70% / 80%。気象は WBGT の5段階。未関連と WBGT 無しはグレー
- 気象距離: 根拠表の表示は予測対象との差（過去走が高いと `+`、低いと `-`）。式は小野・登内 (2014) / 環境省実況推定。モデルの重みは直近の指数減衰
- 推定 WBGT は気象行に保存する。入力の風速・日射も残す。式の版は `wbgt_method=ono2014`
- 平均心拍数は記録時は任意。心拍付きが 6 件未満なら式に心拍を入れない。信頼度は R²（0.70 以上が高、0.40 以上が中）
- 気象の再取得は `(observed_at, station_id)` で upsert する
- 走行・設定・予測はログイン中のアカウント単位。気象観測は地点で共有する。既存の単一プロフィールは `dev@pacecast.local` と `hinagawa1417@gmail.com` にコピーした。他の新規ユーザーは空の設定から始まる

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
| `docs/02_architecture/decisions-2026-09-13.md` | 予測を式モデルにした判断 |
| `docs/02_architecture/decisions-2026-09-15.md` | Next.js が Supabase を直接叩く判断 |
| `docs/02_architecture/decisions-2026-09-16.md` | Vercel へ画面と API を載せる判断 |
| `docs/02_architecture/decisions-2026-09-19.md` | 長時間走の気象を開始・終了の2点平均にした判断 |
| `docs/03_database/database-design.md` | DB 設計 |
| `docs/06_dev/team-setup.md` | 別 PC での環境構築・Git・DB |
| `docs/06_dev/supabase-setup.md` | Supabase プロジェクト作成と接続 |
| `docs/06_dev/gmail-smtp.md` | 確認メール用の専用 Gmail とアプリパスワード |
| `docs/06_dev/vercel-setup.md` | Vercel への公開 |
| `docs/06_dev/figma.md` | 本番デザイン用 Figma の使い方 |

## 開発時の約束

- Python メソッドの docstring は、説明・引数・戻り値を日本語で書く
- 仕様判断を変えたら、このファイルと該当ドキュメントを更新する
- GitHub Issues（[#31](https://github.com/H-Inagawa/pacecast/issues/31)）
  - 登録・コメントの冒頭に `【Cursor自動入力】` を付ける
  - Issue の本文を編集するときは、チャットで指示された内容も記載する（修正の経緯を残す。コメントに残してもよい）
  - Issue は close しない。終了は開発者がプッシュ後に行う
  - `future` は後でやる。今は実装しない
  - `figma` は見た目。実装依頼が来るまで実装しない
  - [#8](https://github.com/H-Inagawa/pacecast/issues/8)（仕様とドキュメント）と [#38](https://github.com/H-Inagawa/pacecast/issues/38)（チーム手順）と [#52](https://github.com/H-Inagawa/pacecast/issues/52)（不要ファイルと Issue の定期整理）も close しない。ずれたら都度直す
  - 今やる実装は `is:open -label:future -label:figma -label:rules`
- 別 PC での起動・`gh` ログイン・DB / Git の進め方は `docs/06_dev/team-setup.md`。確認メール用 Gmail は `docs/06_dev/gmail-smtp.md`
- Cursor からの画面動作確認は `dev@pacecast.local` / `pacecast-dev`（開発テスト１）で行う。テスト用の走行データは自由に登録してよい。私用メール（`hinagawa1417@gmail.com`）では確認しない。画面に繋がらないときはブラウザを待たず、`http://127.0.0.1:3000` が数秒以内に HTTP を返すかを確認する（ポート Listen だけでは足りない）。手順は `docs/06_dev/team-setup.md`
