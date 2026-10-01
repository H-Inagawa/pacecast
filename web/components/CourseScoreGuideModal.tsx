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
        <p>配点の合計は100点です。信号は入れません。配点は次のとおりです。</p>
        <ul className="course-score-guide">
          <li>走りやすい道 30点。大通り、河川敷、公園内の道を走った距離の合計です。同じ区間は一度だけ数えます。全距離が走りやすい道なら満点です。</li>
          <li>直進 10点。辺の平均と最長辺が、指定距離の4分の1に近いほど高くなります。120mより短い辺があると下がります。</li>
          <li>設定距離からの差 20点。指定距離とぴったりなら満点です。指定の±20%の端で0点になります。そこから外れる案は候補から除きます。</li>
          <li>曲がり角 10点。実距離1kmあたり1か所以下なら満点、3回で0点です。</li>
          <li>細い道 10点。細い道を走らないなら満点です。大通りや河川敷、公園内の道、出発点をつなぐ短い区間だけ通ります。</li>
          <li>道路重複 10点。同じ道の往復が0%なら満点、全距離の10%で0点です。10%を超える案は候補から除きます。出発点から周回までの往復は、その先で分かれるなら重複に入れません。</li>
          <li>時計回り 5点。進行方向の回転を足して、1周として時計回り（およそ+360度）に近いほど高くなります。右折の回数は固定しません。</li>
          <li>Uターン 5点。0回なら満点、1回で大きく下がり、2回以上は0点です。</li>
          <li>交差点、上り、下り、信号は点数に入れません。付近の道までの距離も表に出しますが、点数には入れません。</li>
        </ul>
      </div>
    </div>
  );
}
