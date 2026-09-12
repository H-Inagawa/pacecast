# 推定 WBGT とアメダス地点

更新日: 2026-09-12  
根拠: [Issue #34](https://github.com/H-Inagawa/pacecast/issues/34)、[Issue #11](https://github.com/H-Inagawa/pacecast/issues/11)、[Issue #13](https://github.com/H-Inagawa/pacecast/issues/13)

## 1. 式

黒球が無いアメダスでは、環境省の実況推定と同じ全国共通式（小野・登内 2014）を使う。

```
WBGT = 0.735×Ta + 0.0374×RH + 0.00292×Ta×RH + 7.619×SR − 4.557×SR² − 0.0572×WS − 4.064
```

- Ta: 気温（℃）
- RH: 相対湿度（％）
- SR: 全天日射量（kW/m²）。DB には W/m² で持ち、計算時に 1000 で割る
- WS: 平均風速（m/s）

出典: [環境省 熱中症予防情報サイト](https://www.wbgt.env.go.jp/sp/wbgt_detail.php)、小野雅司・登内道彦 (2014) 日本生気象学会雑誌 50(4), 147-157. doi:10.11227/seikisho.50.147

`wbgt_method` は `ono2014`。式を変えたら版を増やして再計算する。

## 2. データの置き場

WBGT は走行テーブルではなく `weather_observations` に持つ。走は従来どおり気象 FK を見る。

風速・日射も残す。WBGT だけだと式を変えたときに戻せない。

入力が欠けたら `wbgt_c` は NULL。予測は WBGT が無い走を使わない。

## 3. 取得元

| 要素 | 優先 |
| --- | --- |
| 気温・湿度 | 直近のアメダス map JSON → Open-Meteo |
| 風速 | 直近のアメダス map JSON → Open-Meteo |
| 日射 | アメダスに値が無い地点が多いので Open-Meteo `shortwave_radiation` |

アメダスの全国マップ JSON（`https://www.jma.go.jp/bosai/amedas/data/map/{YYYYMMDDHHMMSS}.json`）は数日分しか残らない。既存走の埋め戻しは Open-Meteo 再解析（`archive-api`）を主にする。

地点マスタ: `https://www.jma.go.jp/bosai/amedas/const/amedastable.json`。初回取得後は `data/amedastable.json` にキャッシュする。

未設定時の既定地点は東京（観測所 ID `44132`）。設定・走行追加・予報のプルダウンは観測所番号順。既存のテスト用設定は練馬（44071）のまま。手動 CSV は使わない。

## 4. 予測

気象距離の重み付けは `|推定WBGT差|` のみ。近い条件の目安は差 2℃ 以下。根拠表の表示は予測対象との差で、過去走の WBGT が高いと `+`、低いと `-` を付ける。

予測フォームは従来どおり気温・湿度（または予報日時）。送信時に地点の風・日射を足して WBGT を計算する。風・日射が取れないときは風 2.0 m/s、日射は昼間 400 W/m²・夜間 0 W/m² を仮定する。

走行一覧は気温・湿度・WBGTを別列で出し、予測の根拠表にも WBGT を出す。一覧の WBGT 列ヘッダには説明アイコンを付ける。

設定で色分けを「気象条件（WBGT）」にしたとき、行の背景は次の5段階。気象が付いていない走と、WBGT が無い走はグレー。

| 色 | 区分 | WBGT |
| --- | --- | --- |
| 濃い青 | 寒すぎる | 10 未満 |
| 薄い青 | 寒い | 10 以上 15 未満 |
| 緑 | 快適 | 15 以上 21 未満 |
| 黄 | 暑い | 21 以上 28 未満 |
| 赤 | 暑すぎる | 28 以上 |
