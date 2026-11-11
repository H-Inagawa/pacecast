# Android 開発環境・Capacitor 導入

作成日: 2026-11-11  
根拠: [GitHub Issue #65](https://github.com/H-Inagawa/pacecast/issues/65)  
親 Epic: [#35](https://github.com/H-Inagawa/pacecast/issues/35)  
前提調査: [#64](https://github.com/H-Inagawa/pacecast/issues/64)

Windows（PowerShell）前提。当面のゴールは **Google Play 公開ではなく**、Android Studio から私用スマートフォンへデバッグインストールして、既存の PaceCast（Web）を使える状態にすることです。

この文書は手順書です。Capacitor 本体のコードをリポジトリへ入れる作業は、この文書を読んでから #65 の実装として進めます。

## 0. 先に知っておくこと（接続方式）

PaceCast の画面と API は Next.js（`web/`）です。DB 接続の `SUPABASE_SERVICE_ROLE_KEY` は **サーバだけ** が持ちます（ブラウザにも APK にも載せません）。公開先は Vercel（Root Directory = `web/`）。詳細は `docs/02_architecture/system-architecture.md` と `docs/06_dev/vercel-setup.md`。

Capacitor は WebView で Web コンテンツを開く枠です。現状の Next.js は App Router + Route Handlers（SSR / サーバ API）なので、**アプリに静的エクスポートした HTML だけを詰める方式は採りません**（API・Cookie 認証・`service_role` がサーバ側に残る構成を崩すため）。

### 採用する接続方式（当面）

| モード | WebView が開く先 | いつ使うか |
| --- | --- | --- |
| **本番相当（推奨の既定）** | Vercel の HTTPS URL（例: `https://….vercel.app`） | 私用端末で日常利用・動作確認 |
| **ローカル開発** | PC 上の Next.js（端末から見える LAN IP。例: `http://192.168.0.12:3000`） | 画面・API を直してすぐ実機で見るとき |

```
[Android アプリ / Capacitor WebView]
        |
        |  HTTPS（本番相当）または HTTP（LAN 開発）
        v
[Next.js = 画面 + /api ]  … Vercel または PC の npm run dev
        |
        |  service_role（サーバのみ）
        v
[Supabase PostgreSQL]
```

### 採らない案

| 案 | 理由 |
| --- | --- |
| `next export` / 全面静的化して APK に同梱 | `/api`・Cookie 認証・サーバ専用の秘密情報がそのままでは動かない。既存スタックを大きく変える |
| APK に `SUPABASE_SERVICE_ROLE_KEY` を入れる | APK から抜かれる。現状の設計に反する |
| 端末の `http://127.0.0.1:3000` を開く | 端末自身を指す。PC の開発サーバには届かない |

[#64](https://github.com/H-Inagawa/pacecast/issues/64) で上記を正式に記録する想定です。調査 Issue が未完でも、#65 はこの接続方式で進めて問題ありません（食い違ったら #64 の結論に合わせてこの文書を直します）。

### Cookie・HTTPS について

- セッション Cookie は `pacecast_session`（`httpOnly`、`sameSite=lax`）。本番（Vercel）では `secure` が付きます
- WebView から **HTTPS の同一オリジン**（Vercel）を開けば、ブラウザと同様に Cookie 認証が使えます
- LAN の HTTP 開発では Cookie の `secure` が付かないローカル Next.js を想定します。問題が出たら #64 / #65 に残してから直します

## 1. 用意するもの

| もの | 内容 |
| --- | --- |
| PC | Windows。既存どおり Git / Node.js 24 系 / `gh`（`docs/06_dev/team-setup.md`） |
| Android Studio | 最新の安定版（Ladybug 以降で可）。Android SDK・Platform Tools・ビルドツールを同梱インストール |
| JDK | Android Studio 付属の JDK（別途 Oracle JDK を無理に入れない） |
| 実機 | USB デバッグ可能な Android スマートフォン（当面の確認先） |
| 公開 URL | Vercel にデプロイ済みの PaceCast（`docs/06_dev/vercel-setup.md`） |

エミュレータでもビルド確認はできますが、GPS や実機の見え方は #66 / #67 で実機を優先します。

## 2. Android Studio を入れる

1. [https://developer.android.com/studio](https://developer.android.com/studio) から Android Studio を入れる
2. 初回ウィザードで **Standard** インストールでよい
3. **Settings → Languages & Frameworks → Android SDK** で次を確認する
   - Android SDK Platform（API レベルは Capacitor が要求する最低以上。導入時点の Capacitor ドキュメントに合わせる）
   - Android SDK Build-Tools
   - Android SDK Platform-Tools（`adb`）
4. PowerShell で `adb` が通るか確認する（通らなければ Android Studio の SDK `platform-tools` を PATH に足す）

```powershell
adb version
```

## 3. 実機の USB デバッグ

1. 端末の **設定 → デバイス情報** でビルド番号を連続タップし、開発者向けオプションを有効にする
2. **開発者向けオプション → USB デバッグ** をオン
3. USB で PC に接続し、端末側で「このコンピュータを許可」を承認
4. 接続確認

```powershell
adb devices
```

`device` と出ていればよいです。`unauthorized` なら端末の許可ダイアログを確認します。

## 4. リポジトリ上の置き場所（方針）

Next.js 本体（`web/`）はそのままにします。Capacitor は **薄い Android シェル** として、リポジトリ直下に `mobile/` を置く想定です。

```
pacecast/
  web/                 Next.js（画面・API。変更を最小に）
  mobile/              Capacitor シェル（この Issue で追加）
    package.json
    capacitor.config.ts
    android/           npx cap add android で生成
  docs/06_dev/
    android-capacitor.md   ← この文書
```

- `mobile/android/` は Capacitor / Android Studio が生成するプロジェクトです
- `SUPABASE_*` や SMTP の秘密情報は `mobile/` に置きません
- Google Play 用の署名鍵・ストア掲載は対象外です（#65 の完了条件どおり）

### `.gitignore` に足す候補（実装時）

導入時に、次のようなローカル生成物を無視します（実際のパスは生成後に合わせて調整）。

- `mobile/node_modules/`
- `mobile/android/.gradle/`
- `mobile/android/app/build/`
- `mobile/android/local.properties`（SDK パス。PC ごとに違う）
- キーストア（もし作ってもリポジトリに入れない）

## 5. Capacitor シェルの初期化（実装時の手順）

作業ブランチを切ってから進めます。パッケージのメジャー版は、実行時点の [Capacitor 公式](https://capacitorjs.com/docs) に合わせてください。

```powershell
cd C:\dev\PaceCast
mkdir mobile
cd mobile
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
```

`npx cap init` の対話例:

| 項目 | 例 |
| --- | --- |
| App name | `PaceCast` |
| App ID | `app.pacecast.android`（後から変えにくいので慎重に） |
| Web dir | 仮で `www`（中身はほぼ使わない。実体は `server.url`） |

`www` に最低限のプレースホルダを置きます（Capacitor がディレクトリを要求するため）。本番の画面はサーバ側です。

```powershell
mkdir www
Set-Content -Encoding utf8 www\index.html "<!doctype html><title>PaceCast</title><p>Loading…</p>"
```

### `capacitor.config.ts`（接続の中心）

本番相当（Vercel）を既定にする例です。**自分の Vercel URL に置き換えてください。**

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pacecast.android",
  appName: "PaceCast",
  webDir: "www",
  server: {
    // 本番相当: Vercel の HTTPS
    url: "https://YOUR-PROJECT.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
```

ローカル開発に切り替えるときだけ、一時的に次のようにします（コミットしないか、別ファイル・環境変数で切り替える）。

```ts
server: {
  // 例: PC の LAN IP。ipconfig で確認。127.0.0.1 は使わない
  url: "http://192.168.0.12:3000",
  cleartext: true,
},
```

PC 側は従来どおりです。

```powershell
cd C:\dev\PaceCast\web
npm run dev
```

端末と PC が同じ Wi-Fi にいること、Windows ファイアウォールで Node / ポート 3000 を許可していることを確認します。

### Android プラットフォームを追加する

```powershell
cd C:\dev\PaceCast\mobile
npx cap add android
npx cap sync android
npx cap open android
```

`cap open android` で Android Studio が開きます。初回は Gradle の同期に時間がかかることがあります。

## 6. Android Studio からビルド・実機実行

1. Android Studio で `mobile/android` が開いていることを確認
2. 上部のデバイス一覧で、USB 接続した実機を選ぶ
3. **Run**（緑の三角）でデバッグインストール
4. 起動後、WebView に Vercel（または LAN の Next.js）のログイン画面が出ること
5. 開発テスト１でログインできること
   - メール: `dev@pacecast.local`
   - パスワード: `pacecast-dev`
   - ログイン画面にアカウント情報は出さない（仕様どおり）

ログイン後、ホーム・走行記録・予測など主要画面が開けることを確認します（細かい Android UI 差は [#66](https://github.com/H-Inagawa/pacecast/issues/66)、実機確認の通しは [#67](https://github.com/H-Inagawa/pacecast/issues/67)）。

### よく使うコマンド

```powershell
cd C:\dev\PaceCast\mobile

# 設定や www・プラグインを変えたあと
npx cap sync android

# Android Studio を開く
npx cap open android

# 実機のログ（WebView / アプリ）
adb logcat
```

Web 側（`web/`）だけ直して Vercel に載せる場合、**シェルの再ビルドは不要**です（WebView がサーバを見ているため）。`capacitor.config.ts` やネイティブ権限を変えたときだけ `cap sync` / 再インストールが必要です。

## 7. 権限（初期は最小）

初期の Android アプリ化では、走行 GPS トラッキングや Health Connect は [#14](https://github.com/H-Inagawa/pacecast/issues/14) 側です。`AndroidManifest.xml` に位置情報などを **先回りで足さない**でください。

Web 版ですでに使っている「GPSで探す」（アメダス最寄り）は、ブラウザの Geolocation です。Capacitor 上で動かない・許可が出ない場合は、Capacitor の Geolocation プラグインや HTTPS 要件を #66 / #67 で扱います。初期導入（#65）の必須にはしません。

## 8. セキュリティ（短く）

- APK に `SUPABASE_SERVICE_ROLE_KEY`・SMTP パスワード・`PACECAST_SECRET` を入れない
- 既定の接続先は HTTPS（Vercel）
- デバッグ用の `cleartext`（HTTP）は開発中だけ。本番相当の設定ではオフ
- アプリ署名鍵を作る場合もリポジトリに入れない（Play 公開は対象外）

継続的な検査体制は [#63](https://github.com/H-Inagawa/pacecast/issues/63) 系です。

## 9. トラブルシュート

| 症状 | 確認すること |
| --- | --- |
| 白い画面・Loading のまま | `server.url` が正しいか。Vercel が落ちていないか。実機のネット |
| ログインできない | 本番は HTTPS か。Cookie / 時刻ずれ。Vercel の環境変数 |
| LAN 開発で繋がらない | `127.0.0.1` を使っていないか。PC の LAN IP か。同一 Wi-Fi か。ファイアウォール。`cleartext: true` か |
| `adb devices` が空 | USB デバッグ許可。別のケーブル。ドライバ |
| Gradle 同期失敗 | Android Studio の SDK インストール。ネットワーク。Android Studio の提案どおり Invalidate / Restart |
| `cap sync` で webDir エラー | `mobile/www` があるか |

## 10. #65 の完了条件との対応

| 完了条件 | この文書での扱い |
| --- | --- |
| Capacitor 入りの Android プロジェクトがリポジトリ方針どおり | `mobile/` + `npx cap add android`（実装時） |
| Android Studio からビルドできる | セクション 6 |
| 接続方式がドキュメントにある | セクション 0・5 |
| Google Play 署名・掲載は含めない | 対象外と明記 |

## 11. 次の Issue

1. （推奨）[#64](https://github.com/H-Inagawa/pacecast/issues/64) に、この文書の接続方式を調査結果としてコメント／本文反映する  
2. [#65](https://github.com/H-Inagawa/pacecast/issues/65) で `mobile/` を実装し、この手順でビルド・実機起動まで通す  
3. [#66](https://github.com/H-Inagawa/pacecast/issues/66) Android 固有 UI・戻るボタンなど  
4. [#67](https://github.com/H-Inagawa/pacecast/issues/67) 実機での主要機能の通し確認  

関連: 別 PC の Web 開発は `docs/06_dev/team-setup.md`、Vercel は `docs/06_dev/vercel-setup.md`。
