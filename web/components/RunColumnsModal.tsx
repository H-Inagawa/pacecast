"use client";

import { useState } from "react";
import {
  RUN_COLUMN_LABELS,
  RUN_DETAIL_COLUMNS,
  WEATHER_RUN_COLUMNS,
  type OptionalRunColumn,
  type RunColumnVisibility,
} from "../lib/runColumns";

type Props = {
  open: boolean;
  columns: RunColumnVisibility;
  onSave: (columns: RunColumnVisibility) => void;
  onClose: () => void;
};

function CheckRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (visible: boolean) => void;
}) {
  return (
    <li>
      <label className="choice">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        />
        {label}
      </label>
    </li>
  );
}

export function RunColumnsModal({ open, columns, onSave, onClose }: Props) {
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

  if (!open) {
    return null;
  }

  function setVisible(key: OptionalRunColumn, visible: boolean) {
    setDraft((current) => ({ ...current, [key]: visible }));
  }

  return (
    <div
      className="modal-backdrop modal-backdrop--wide"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className="modal-panel modal-panel--wide modal-panel--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-columns-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
        <h2 id="run-columns-title">表示項目設定</h2>
        <p className="muted">日時と距離は常に表示します。それ以外の列を選べます。</p>
        <ul className="column-options">
          <CheckRow label={RUN_COLUMN_LABELS.started_at} checked disabled />
          <CheckRow label={RUN_COLUMN_LABELS.distance} checked disabled />
          <li className="column-group-label">走行詳細</li>
          {RUN_DETAIL_COLUMNS.map((key) => (
            <CheckRow
              key={key}
              label={RUN_COLUMN_LABELS[key]}
              checked={draft[key]}
              onChange={(visible) => setVisible(key, visible)}
            />
          ))}
          <li className="column-group-label">気象</li>
          {WEATHER_RUN_COLUMNS.map((key) => (
            <CheckRow
              key={key}
              label={RUN_COLUMN_LABELS[key]}
              checked={draft[key]}
              onChange={(visible) => setVisible(key, visible)}
            />
          ))}
        </ul>
        <div className="column-modal-actions">
          <button type="button" onClick={() => onSave(draft)}>
            保存
          </button>
          <button type="button" className="button ghost" onClick={() => setDraft({ ...baseline })}>
            元に戻す
          </button>
        </div>
      </div>
    </div>
  );
}
