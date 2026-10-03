"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AboutModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="about-title">PaceCastとは？</h2>
        <p>
          過去の走行記録と、そのときの気象から、指定した気象条件・走行強度でのペースとタイムを見積もるアプリです。
          いまはローカルの個人利用を想定しています。
        </p>

        <h3>各画面でできること</h3>
        <ul className="about-list">
          <li>
            <strong>走行記録</strong>
            走った日時・距離・時間を残します。近い時刻の気象と推定 WBGT が付きます。追加・編集はモーダルです。
          </li>
          <li>
            <strong>パフォーマンスを予測</strong>
            気温・湿度、または予報の日時と地点を指定して、式モデルからペースとタイムを出します。誤差の目安と関係グラフも結果に出します。
          </li>
          <li>
            <strong>ランニング天気予報</strong>
            設定のアメダス地点から3日分の天気、推定 WBGT、走りやすさを表で見ます。地点は GPS でも探せます。
          </li>
          <li>
            <strong>コースを作る</strong>
            距離を入れると、現在地か地図の点に面している細い道・公園内通路を含む、いちばん近い走りやすい道または接続道路から、時計回りに戻る周回を探します。広場や山奥など、近くにスタートできる道が無いときや、希望の周回が作れないときは、起点周辺の走りやすい道を細い青い実線で示し、起点の移動を案内します。通常の結果では、結果ルート周辺の走りやすい道を同じ線で重ねて出します。出発の逆向きも試します。条件を満たす案を最大50件集め、点の高い順に最大5つ出します。地図の下の表で距離・評価・実スコアと内訳を並べ、コース名のボタンで地図の線を切り替えます。各項目の点数は取得点と満点を並べます。
          </li>
          <li>
            <strong>設定</strong>
            表示名、アメダス地点、誕生日を保存します。最大心拍・記録の初期地点・強度別心拍・個人記録の重みは「高度な設定」にあります。
          </li>
        </ul>

        <h3>バージョン</h3>
        <p>0.1.0（ローカル向け）</p>

        <h3>データの出典</h3>
        <ul className="about-list">
          <li>予報と過去の再解析: Open-Meteo</li>
          <li>直近の気温・湿度・風と地点マスタ: 気象庁のアメダス公開データ</li>
          <li>推定 WBGT: 小野・登内 (2014) / 環境省の実況推定と同じ式</li>
        </ul>

        <h3>ライセンス</h3>
        <p>
          PaceCast 本体のライセンスは、まだ決めていません。画面の Next.js / React、API の FastAPI / SQLAlchemy
          などは、それぞれのライセンス（主に MIT / Apache-2.0）に従います。
        </p>
      </div>
    </div>
  );
}
