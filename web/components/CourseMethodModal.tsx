"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CourseMethodModal({ open, onClose }: Props) {
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
        aria-labelledby="course-method-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="course-method-title">作成方法</h2>
        <h3>探し方</h3>
        <p>
          目標は道そのものではなく、概形の頂点です。道の曲線で実ルートが長くなるので、時計回りも長方形も正方形も、直線でつないだ1周が指定距離より約20%短くなる大きさにします。そこを近くの大通りへ寄せ、徒歩でつなぎ、出発点に戻る周回にします。最初に探す形は、時計回りに決めず、その回ごとに時計回り・長方形・正方形から無作為に始めます。
        </p>
        <p>
          正方形と長方形は、近くの大通りの向きに加え、右に45度回した向きも探します。斜めの道でも、辺が道に沿いやすくするためです。南北に長い長方形（南北と東西がおよそ4:1）も足します。出発点が頂点になる案と、辺の途中になる案をそれぞれ作ります。
        </p>
        <p>「必ず4回曲がる」「必ず時計回り」にはしていません。道路の形に合わせて、曲がる回数は前後します。</p>

        <h3>残す条件</h3>
        <p>
          出発点に戻らない案は出しません。5kmまでは、指定の±20%まで、かつ±2kmまでなら満点に近くなります。5kmならおよそ4〜6kmです。そこから外れた案も、±50%かつ±5kmの内側なら候補に残し、点数を下げます。指定が5kmから3km増えるごとに、距離の採点のきつさを5点下げます。26点からで、5点が下限です。同じずれでも点が残り、満点の幅と候補に残す幅がその分広がります。道路の重複が全距離の65%を超える案は除きます。その距離の打ち切り件数に達していないときだけ、その周の実距離の中央値が満点の範囲から外れていたら、図形の大きさを2%ずつ変えて、最大10回まで探します。
        </p>
        <p>
          除外を通った案が打ち切り件数に達したら、残りの目標点は経路を聞かず、図形の大きさ調整もそこで終えて、点の高い順に最大5件を出します。打ち切りは5kmまで25件です。指定が5kmから3km増えるごとに5件減らし、5件が下限です。ほぼ同じ線は1本にまとめます。
        </p>

        <h3>点数</h3>
        <p>
          いちばん重く見るのは、曲がりの少なさです。実距離1kmあたり1か所以下なら満点、5回で0点です。その次に、設定した距離との差です。ぴったりなら満点で、5kmまでは指定の±20%と±2kmのうち狭い方の端で0点です。長い距離では、その端が広がります。その次に、同じ道の往復の少なさです。往復が0%なら満点、全距離の20%で0点です。その次に直進、最後に信号です。信号は、実距離1kmあたり5基で0点です。曲がって渡る信号と、信号のある交差点で道路を横断するときの信号を数えます。道なりに直進して横を通る信号は入れません。大通りと交差点は点数に入れません。画面に出す点数は、今回の候補でいちばん高い素点を100点にした相対評価です。
        </p>
        <p>
          設定距離から離れると、ほかの項目が高くても下になります。往復や曲がりが多い案も下がります。
        </p>

        <h3>画面の数字</h3>
        <p>
          予想ペースと予想タイムは出しません。地図の下に、距離・評価・実スコアと内訳の表を出します。コース名のボタンを押すと、地図に出す線が切り替わります。評価は今回のいちばん高い実スコアを100点にしたものです。各項目のカッコ内は実スコアです。右上の「採点基準」に配点を出します。信号は、曲がって渡るものと、信号のある交差点で道路を横断するものを数えます。大通りは、幹線・主要道から30m以内を走った距離です。道路重複は、逆方向に同じ場所を走る距離の割合です。高低差は標高データから出します。
        </p>
        <p>コースは保存しません。作成には数分かかることがあります。</p>
        <p>道路データの公開サービスが混み合っているときは、1〜2分待ってからもう一度作成してください。そのとき、すでに出ている候補はそのまま表示します。</p>
      </div>
    </div>
  );
}
