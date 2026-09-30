"use client";

import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CourseScoreGuideModal({ open, onClose }: Props) {
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
          画面の点数は、今回出たコースの中でいちばん高い素点を100点にした相対評価です。ほかのコースは、その素点との比で点数を付け直します。表の各点数も同じ比で伸び縮みし、合計がカードの点数になります。
        </p>
        <p>素点は100点満点です。配点は次のとおりです。</p>
        <ul className="course-score-guide">
          <li>道路重複 28点。同じ道の往復が0%なら満点、全距離の30%で0点です。50%を超える案は候補から除きます。</li>
          <li>大通り 22点。走った距離のうち、幹線・主要道から30m以内の割合です。全部大通りなら満点です。</li>
          <li>曲がり角 18点。4回まで満点で、10回で0点です。その間は直線で下がります。</li>
          <li>距離への近さ 12点。指定距離とぴったりなら満点です。指定の±20%と±2kmのうち、狭い方の端で0点になります。</li>
          <li>直進 10点。辺の平均と最長辺が、指定距離の4分の1に近いほど高くなります。120mより短い辺があると下がります。</li>
          <li>信号 6点。0基なら満点です。距離1kmあたり2基で0点です。信号は地図データ上の数です。</li>
          <li>交差点 4点。大通りどうしの交点です。0なら満点で、距離（km）と6の大きい方の個数で0点です。</li>
          <li>上りと下りは点数に入れません。</li>
        </ul>
      </div>
    </div>
  );
}
