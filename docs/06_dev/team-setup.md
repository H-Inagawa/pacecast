# 別 PC での作業開始

作成日: 2026-09-12  
根拠: [GitHub Issue #38](https://github.com/H-Inagawa/pacecast/issues/38)

Windows（PowerShell）前提。仕様の正は `AGENTS.md`。構想の原文は `docs/00_concept/` と `docs/05_improvements/`。

## 1. 入れるもの

- Git
- Python 3.11 以降
- Node.js 20 以降
- [GitHub CLI](https://cli.github.com/)（`gh`）

GitHub CLI は winget で入れます。入れたらターミナルを開き直します。

```powershell
winget install --id GitHub.cli
```

リポジトリを clone し、作業ブランチを出します。

```powershell
git clone https://github.com/H-Inagawa/pacecast.git
cd pacecast
git checkout develop/v0.1
```

## 2. GitHub にログインする

clone したディレクトリで次を実行します。

```powershell
gh auth login
```

対話では次を選びます。

1. GitHub.com
2. HTTPS
3. Git の認証に GitHub の資格情報を使う: Yes
4. Login with a web browser

通ったかは次で確認します。Issue の一覧が出れば十分です。

```powershell
gh auth status
gh issue list
```

Cursor から Issue を登録・コメントするときは、本文の先頭に `【Cursor自動入力】` を付けます。Issue は Cursor から close しません（[#31](https://github.com/H-Inagawa/pacecast/issues/31)）。[#8](https://github.com/H-Inagawa/pacecast/issues/8) と [#38](https://github.com/H-Inagawa/pacecast/issues/38) も close せず、足りない・ずれたときに都度直します。

## 3. アプリを動かす

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
cd web
npm install
```

API と画面は別のターミナルで起動します。

```powershell
uvicorn pacecast.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd web
npm run dev
```

ブラウザは http://127.0.0.1:3000 です。ログイン画面では、登録なしで次を入れます。

- メール: `dev@pacecast.local`
- パスワード: `pacecast-dev`

SMTP を置いていなければ、新規登録後に画面へ確認リンクが出ます。メールを送るときは `PACECAST_SMTP_HOST` などを設定します。停止とポート解放は `README.md` を見てください。

```powershell
pytest
cd web
npm test
```

## 4. 走行データの扱い

`data/pacecast.db` は Git に載せません。各 PC の DB は独立です。clone した直後は空で起動します。空でも画面は壊れません。

共有したいときだけ、API を止めてからファイルをコピーします。どちらを正にするかは、コピーした人が決めます。定期バックアップは [#17](https://github.com/H-Inagawa/pacecast/issues/17)（`future`）。

## 5. Git の進め方

- 日常の作業は `develop/v0.1`
- `master` は区切りの安定版
- 2 台で同じブランチへ同時に push しない
- 別作業なら `feature/...` を切り、`develop/v0.1` へ PR してマージする
- 片方がそのブランチを編集しているあいだ、もう片方は `git pull` して読むだけ
- Cursor は依頼されない限り commit / push しない
- Issue の close は、開発者が push したあと行う

## 6. 今やる / 後でやる

GitHub Projects や Milestone は使わず、ラベルで分けます。

| 見え方 | 意味 |
| --- | --- |
| `future` が付いている | 後でやる。今は実装しない |
| `figma` | 見た目の本番。実装 Issue とは別。ラフ（Excalidraw）はしない |
| それ以外の Open | 着手してよい |

今やるものだけ見るとき:

```powershell
gh issue list --search "is:open -label:future"
```

デザインの実ファイル（Figma）の URL は、各子 Issue（[#18](https://github.com/H-Inagawa/pacecast/issues/18) の表）の本文に貼ります。未作成なら「未」のままです。画面はすでに動いているので、ラフスケッチはしません。
