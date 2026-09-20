"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PredictHelpModal({ open, onClose }: Props) {
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
        aria-labelledby="predict-help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="predict-help-title">予測の見方</h2>
        <h3>予測の方法</h3>
        <p>
          気象が付き、推定 WBGT がある過去走から、直近ほど重い重み付き最小二乗でペースの式を当てはめます。計算は
          km/h、画面の表示は秒/km です。
        </p>
        <p>
          説明変数は推定 WBGT・距離・心拍です。件数に応じて、主効果のあとに交差項（変数同士の掛け算）と 2
          次項を足します。変数は標準化してから使います。心拍付きの走が 6 件未満のときは、心拍を式に入れません。
        </p>
        <p>未関連の走と、推定 WBGT が無い走は使いません。予想平均心拍は結果に出しません。</p>

        <h3>妥当性の見方</h3>
        <ul className="about-list">
          <li>
            <strong>RMSE</strong>
            学習した過去走に対する誤差の目安です。単位は秒/km。予想ペースの前後に、これくらいの幅を見てください。
          </li>
          <li>
            <strong>R²</strong>
            式が過去走のペースのばらつきをどれだけ説明できたか（0〜1）です。大きいほど当てはまりが良いです。
          </li>
          <li>
            <strong>信頼度</strong>
            R² が 0.70 以上なら高、0.40 以上なら中、それ未満は低です。件数が少ないと 2 次まで入れず、当てはまりも下がりやすいです。
          </li>
        </ul>
        <p>
          下のグラフは、他の条件を今回の予測値に固定したときの関係です。点は過去走、線は式です。分析画面の散布図とは役割が違います。
        </p>
      </div>
    </div>
  );
}
