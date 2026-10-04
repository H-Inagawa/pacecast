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
        <p>
          距離と起点から、OpenStreetMap の走りやすい道（歩道付きの道、歩行者・自転車が通れる道、公園内の通路、河川敷など）をつないで、出発点へ戻る周回を探します。独立歩道そのものは使わず、隣の車道を歩道付きとして扱います。閉じないときは生活道路などでつなぎます。
        </p>
        <p>
          スタートは、面している細い道や公園内の通路を含む、いちばん近い走りやすい道または接続道路から始めます。近くにスタートできる道が無いときや、希望の周回が作れないときは、起点周辺の走りやすい道を細い青線で示します。出発の逆向きも探し、向きが重ならない候補を最大5件出します。
        </p>
        <p>
          予想ペースと予想タイムは出しません。地図の下の表で候補を比べられ、コース名のボタンで地図の線を切り替えます。配点の詳細は「採点基準」を見てください。コースは保存しません。作成には数分かかることがあり、検索中は「検索を中止」で止められます。道路データが混んでいるときは、1〜2分待ってからもう一度作成してください。
        </p>
      </div>
    </div>
  );
}
