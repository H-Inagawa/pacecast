"use client";

import { useEffect } from "react";

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
            気温・湿度、または予報の日時と地点を指定して、似た過去走からペースとタイムを出します。
          </li>
          <li>
            <strong>分析結果</strong>
            推定 WBGT と走行ペースの関係を散布図で見ます。気象や WBGT が無い走は含めません。
          </li>
          <li>
            <strong>設定</strong>
            表示名、アメダス地点、最大心拍、強度別心拍を保存します。
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

        <div className="actions">
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
