"use client";

import { useEffect } from "react";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RunnabilityModal({ open, onClose }: Props) {
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
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="runnability-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="runnability-title">走りやすさ</h2>
        <p>
          100点満点で、走りやすさを採点します。
          <br />
          適温は WBGT 10℃以上 15℃未満です。
        </p>
        <h3>WBGT</h3>
        <table className="runnability-table">
          <thead>
            <tr>
              <th scope="col">WBGT</th>
              <th scope="col">減点</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">10未満（寒すぎる）</th>
              <td>適温から離れるたびに、-1点/℃</td>
            </tr>
            <tr>
              <th scope="row">10以上15未満</th>
              <td>満点</td>
            </tr>
            <tr>
              <th scope="row">15以上21未満（快適）</th>
              <td>適温から離れるたびに、-2点/℃</td>
            </tr>
            <tr>
              <th scope="row">21以上28未満（暑い）</th>
              <td>適温から離れるたびに、-4点/℃</td>
            </tr>
            <tr>
              <th scope="row">28以上（暑すぎる）</th>
              <td>適温から離れるたびに、-6点/℃</td>
            </tr>
          </tbody>
        </table>
        <h3>天気</h3>
        <table className="runnability-table">
          <thead>
            <tr>
              <th scope="col">天気</th>
              <th scope="col">減点</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">快晴・晴れ</th>
              <td>満点</td>
            </tr>
            <tr>
              <th scope="row">霧</th>
              <td>-15点</td>
            </tr>
            <tr>
              <th scope="row">霧雨</th>
              <td>-25点</td>
            </tr>
            <tr>
              <th scope="row">にわか雨</th>
              <td>-30点</td>
            </tr>
            <tr>
              <th scope="row">雨</th>
              <td>-40点</td>
            </tr>
            <tr>
              <th scope="row">にわか雪</th>
              <td>-40点</td>
            </tr>
            <tr>
              <th scope="row">雪</th>
              <td>-50点</td>
            </tr>
            <tr>
              <th scope="row">雷雨</th>
              <td>-60点</td>
            </tr>
          </tbody>
        </table>
        <h3>評価ランク</h3>
        <table className="runnability-table">
          <thead>
            <tr>
              <th scope="col">点数</th>
              <th scope="col">評価</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">90点以上</th>
              <td>😄</td>
            </tr>
            <tr>
              <th scope="row">80点以上</th>
              <td>🙂</td>
            </tr>
            <tr>
              <th scope="row">60点以上</th>
              <td>😐</td>
            </tr>
            <tr>
              <th scope="row">30点以上</th>
              <td>😣</td>
            </tr>
            <tr>
              <th scope="row">30点未満</th>
              <td>😫</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
