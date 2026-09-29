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
            設定のアメダス地点から3日分の天気と推定 WBGT を、グラフと3時間ごとの表で見ます。
          </li>
          <li>
            <strong>コースを作る</strong>
            距離を入れると、現在地か地図の点から、大通りの周回を最大3つ出します。折り返しがあっても、元の距離と折り返しを除いた距離の両方が近いものだけ残します。予想タイム、地図データ上の信号、高低差を見ます。
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
