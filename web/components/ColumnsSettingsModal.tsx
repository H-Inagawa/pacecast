"use client";

import { useState, type ReactNode } from "react";
import { ModalShell } from "./ModalShell";

export type ColumnCheckRow = {
  key: string;
  label: string;
  required?: boolean;
};

type Props<T extends Record<string, boolean>> = {
  open: boolean;
  titleId: string;
  columns: T;
  rows: ColumnCheckRow[];
  onSave: (columns: T) => void;
  onClose: () => void;
  description?: ReactNode;
  groups?: Array<{ label: string; beforeKey: string }>;
  backdropClassName?: string;
  panelClassName?: string;
};

/**
 * 表示項目設定モーダルの共通実装（下書き・保存・元に戻す）。
 */
export function ColumnsSettingsModal<T extends Record<string, boolean>>({
  open,
  titleId,
  columns,
  rows,
  onSave,
  onClose,
  description,
  groups = [],
  backdropClassName = "modal-backdrop",
  panelClassName = "modal-panel modal-panel--compact",
}: Props<T>) {
  const [draft, setDraft] = useState(columns);
  const [baseline, setBaseline] = useState(columns);
  const [captured, setCaptured] = useState(false);

  if (open && !captured) {
    setDraft({ ...columns });
    setBaseline({ ...columns });
    setCaptured(true);
  }
  if (!open && captured) {
    setCaptured(false);
  }

  const groupBefore = new Map(groups.map((group) => [group.beforeKey, group.label]));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId={titleId}
      backdropClassName={backdropClassName}
      panelClassName={panelClassName}
    >
      <h2 id={titleId}>表示項目設定</h2>
      {description}
      <ul className="column-options">
        {rows.flatMap((row) => {
          const nodes = [];
          const groupLabel = groupBefore.get(row.key);
          if (groupLabel) {
            nodes.push(
              <li key={`group-${row.key}`} className="column-group-label">
                {groupLabel}
              </li>,
            );
          }
          nodes.push(
            <li key={row.key}>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={row.required ? true : Boolean(draft[row.key as keyof T])}
                  disabled={row.required}
                  onChange={
                    row.required
                      ? undefined
                      : (event) =>
                          setDraft((current) => ({
                            ...current,
                            [row.key]: event.target.checked,
                          }))
                  }
                />
                {row.label}
              </label>
            </li>,
          );
          return nodes;
        })}
      </ul>
      <div className="column-modal-actions">
        <button type="button" onClick={() => onSave(draft)}>
          保存
        </button>
        <button type="button" className="button ghost" onClick={() => setDraft({ ...baseline })}>
          元に戻す
        </button>
      </div>
    </ModalShell>
  );
}
