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
    <div className="modal-backdrop modal-backdrop--wide" onClick={onClose} role="presentation">
      <div
        className="modal-panel modal-panel--wide about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="predict-help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="predict-help-title">予測の見方</h2>
        <h3>予測の方法</h3>
        <p>
          気象が付き、推定 WBGT がある過去走を使います。心拍付きが 6 件以上あるときは、目標心拍へ補正したペースを、速い走・直近・予測
          WBGT との近さ・予測距離との近さで重み付けして基準にします。計算は km/h、画面の表示は秒/km です。
        </p>
        <p>
          その基準に、一般的な WBGT の影響と、自分の記録から見た WBGT の影響を混ぜた補正をかけます。混ぜる割合は、今回の距離と WBGT
          の階級（5 km 刻み・5℃ 刻み）に記録がどれだけ近いかで決まります。心拍付きが 6 件未満のときや、心拍とペースの関係が使えないときは、従来の式に戻します。
        </p>
        <p>未関連の走と、推定 WBGT が無い走は使いません。予想平均心拍は結果に出しません。</p>

        <h3>妥当性の見方</h3>
        <ul className="about-list">
          <li>
            <strong>RMSE</strong>
            学習した過去走に対する誤差の目安です。単位は秒/km。予想ペースと予想タイムは、この幅を足した範囲で出します。
          </li>
          <li>
            <strong>R²</strong>
            式が過去走のペースのばらつきをどれだけ説明できたか（0〜1）です。大きいほど当てはまりが良いです。
          </li>
          <li>
            <strong>信頼度</strong>
            R² が 0.70 以上なら高、0.40 以上なら中、それ未満は低です。
          </li>
        </ul>
        <p>
          下のグラフの線は、今回当てはめた式です。点は過去走、星は今回の予想です。WBGT
          のグラフは補正後のペースで、予測する WBGT と最適 WBGT の前後まで出します。心拍のグラフには、速度と心拍の式を載せます。分析画面の散布図とは役割が違います。
        </p>
      </div>
    </div>
  );
}
