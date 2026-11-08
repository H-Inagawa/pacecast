"use client";

import type { ReactNode } from "react";
import { useModalLock } from "../hooks/useModalLock";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
};

/**
 * 半透明モーダルの共通シェル（背景クリック・Escape・×・スクロールロック）。
 */
export function ModalShell({
  open,
  onClose,
  titleId,
  children,
  backdropClassName = "modal-backdrop",
  panelClassName = "modal-panel",
}: Props) {
  useModalLock(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className={backdropClassName} onClick={onClose} role="presentation">
      <div
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        {children}
      </div>
    </div>
  );
}
