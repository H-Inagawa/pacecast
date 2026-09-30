"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CourseScoreGuideModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop course-guide-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-score-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="course-score-guide-title">採点基準</h2>
        <p>
          画面の評価は、今回出たコースの中でいちばん高い実スコアを100点にした相対評価です。ほかのコースは、その実スコアとの比で評価を付け直します。各項目のカッコ内は実スコアで、評価の行は相対、実スコアの行は素点の合計です。
        </p>
        <p>素点は100点満点です。配点は次のとおりです。</p>
        <ul className="course-score-guide">
          <li>曲がり角 34点。実距離1kmあたり1か所以下なら満点、5回で0点です。</li>
          <li>
            設定距離からの距離 26点。指定距離とぴったりなら満点です。5kmまでは、指定の±20%と±2kmのうち狭い方の端で0点になります。指定が5kmから3km増えるごとに、このきつさを5点下げます。5点が下限です。
          </li>
          <li>道路重複 20点。同じ道の往復が0%なら満点、全距離の20%で0点です。65%を超える案は候補から除きます。</li>
          <li>直進 12点。辺の平均と最長辺が、指定距離の4分の1に近いほど高くなります。120mより短い辺があると下がります。</li>
          <li>
            信号 8点。0基なら満点です。実距離1kmあたり5基で0点です。曲がって渡る信号と、信号のある交差点で道路を横断する信号を数えます。道なりに直進して横を通る信号は入れません。同じ曲がりにある信号は1つにまとめます。
          </li>
          <li>大通り、交差点、上り、下りは点数に入れません。</li>
        </ul>
      </div>
    </div>
  );
}
