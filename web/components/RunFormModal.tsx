"use client";

import { useEffect } from "react";
import { RunForm } from "./RunForm";

type Props = {
  open: boolean;
  runId?: number;
  onClose: () => void;
  onSaved?: () => void;
};

export function RunFormModal({ open, runId, onClose, onSaved }: Props) {
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

  const title = runId ? "走行記録を編集" : "走行記録を追加";

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <RunForm
          key={runId ?? "new"}
          title={title}
          runId={runId}
          variant="modal"
          onCancel={onClose}
          onSuccess={() => {
            onClose();
            onSaved?.();
          }}
        />
      </div>
    </div>
  );
}
