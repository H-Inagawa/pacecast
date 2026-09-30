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
          先に時計回りの目標を置き、その次に長方形と正方形を置きます。目標は道そのものではなく、概形の頂点です。そこを近くの大通りへ寄せ、徒歩でつなぎ、出発点に戻る周回にします。
        </p>
        <p>
          正方形と長方形は、近くの大通りの向きに加え、右に45度回した向きも探します。斜めの道でも、辺が道に沿いやすくするためです。南北に長い長方形（南北と東西がおよそ4:1）も足します。出発点が頂点になる案と、辺の途中になる案をそれぞれ作ります。
        </p>
        <p>「必ず4回曲がる」「必ず時計回り」にはしていません。道路の形に合わせて、曲がる回数は前後します。</p>

        <h3>残す条件</h3>
        <p>
          出発点に戻らない案は出しません。距離は、指定の±20%まで、かつ±2kmまでなら満点に近くなります。5kmならおよそ4〜6kmです。そこから少し外れた案も、±35%かつ±3.5kmの内側なら候補に残し、点数を下げます。
        </p>
        <p>
          同じ道を逆に走る距離が、全距離の半分を超える案は除きます。除外を通った案が3件を超えたら、残りの目標点は経路を聞かず、点の高い順に最大3件を出します。ほぼ同じ線は1本にまとめます。
        </p>

        <h3>点数</h3>
        <p>
          いちばん重く見るのは、同じ道の往復（道路の重複）です。往復が少ない案を上にします。その次に、大通りを長く走ることと、曲がりの少なさを重く見ます。その次に、指定距離への近さ、長く直進できること、信号と大通りの交差点の少なさを見ます。画面に出す点数は、今回の候補でいちばん高い素点を100点にした相対評価です。
        </p>
        <p>
          距離がぴったりでも、往復や曲がりが多い案は下がります。少し距離がずれていても、往復が少なく長く走れる案が上になります。
        </p>

        <h3>画面の数字</h3>
        <p>
          予想ペースと予想タイムは出しません。カードには実距離と評価点を出し、信号・曲がり角・大通り・道路重複・上り下りと点数の内訳は「評価詳細」で見ます。信号は地図データ上の数です。大通りは、幹線・主要道から30m以内を走った距離です。道路重複は、逆方向に同じ場所を走る距離の割合です。高低差は標高データから出します。
        </p>
        <p>コースは保存しません。作成には数分かかることがあります。</p>
        <p>道路データの公開サービスが混み合っているときは、1〜2分待ってからもう一度作成してください。そのとき、すでに出ている候補はそのまま表示します。</p>
      </div>
    </div>
  );
}
