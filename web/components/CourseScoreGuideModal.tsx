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
          画面の評価は、今回出たコースの中でいちばん高い実スコアを100点にした相対評価です。ほかのコースは、その実スコアとの比で評価を付け直します。各項目のカッコ内は実スコアで、評価の行は相対、実スコアの行は素点の合計です。表示順は点数の高いコースからです。
        </p>
        <p>配点の合計は100点です。配点は次のとおりです。</p>
        <ul className="course-score-guide">
          <li>設定距離からの差 20点。指定距離とぴったりなら満点です。指定の±20%の端で0点になります。そこから外れる案は候補から除きます。</li>
          <li>
            走りやすい道 20点。歩道タグ付きの道、独立歩道が隣接する道、歩行者・自転車が通れる道、公園内の通路、河川敷の経路を走った距離の割合です。独立歩道そのものは含めません。全距離が走りやすい道なら満点です。
          </li>
          <li>
            細い道 20点。接続用の生活道路などを走った距離の割合が少ないほど高いです。全距離の25%で0点、40%を超える案は候補から除きます。
          </li>
          <li>直進 10点。辺の平均と最長辺が、指定距離の4分の1に近いほど高くなります。120mより短い辺があると下がります。</li>
          <li>信号 10点。信号付きの横断歩道を通る回数が少ないほど高いです。実距離1kmあたり5回で0点です。</li>
          <li>曲がり角 10点。実距離1kmあたり1か所以下で満点、3か所で0点です。</li>
          <li>道路重複 10点。同じ道の往復が0%なら満点、全距離の10%で0点です。10%を超える案は候補から除きます。出発点から周回までの往復は、その先で分かれるなら重複に入れません。</li>
          <li>交差点、上り、下り、時計回り、Uターンは点数に入れません。</li>
          <li>表の各項目のカッコ内は、その項目の取得点と満点です（例: 15.5 / 20点）。</li>
        </ul>
      </div>
    </div>
  );
}
