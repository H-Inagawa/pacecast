"use client";

import { ModalShell } from "./ModalShell";
import { RunForm } from "./RunForm";

type Props = {
  open: boolean;
  runId?: number;
  onClose: () => void;
  onSaved?: () => void;
};

export function RunFormModal({ open, runId, onClose, onSaved }: Props) {
  const title = runId ? "記録を編集" : "記録を追加";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="run-form-title"
      backdropClassName="modal-backdrop modal-backdrop--wide"
      panelClassName="modal-panel modal-panel--wide modal-panel--compact"
    >
      <RunForm
        key={runId ?? "new"}
        title={title}
        runId={runId}
        onCancel={onClose}
        onSuccess={() => {
          onClose();
          onSaved?.();
        }}
      />
    </ModalShell>
  );
}
