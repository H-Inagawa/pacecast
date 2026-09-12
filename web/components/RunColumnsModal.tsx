"use client";

import { useEffect } from "react";
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
  onChange: (key: OptionalRunColumn, visible: boolean) => void;
  onClose: () => void;
};

function ColumnCheck({
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

export function RunColumnsModal({ open, columns, onChange, onClose }: Props) {
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
        aria-labelledby="run-columns-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="run-columns-title">表示項目設定</h2>
        <p className="lede">一覧に出す列を選びます。日時と距離は必ず表示します。</p>
        <ul className="column-options">
          <ColumnCheck label={RUN_COLUMN_LABELS.started_at} checked disabled />
          <ColumnCheck label={RUN_COLUMN_LABELS.distance} checked disabled />
          {RUN_DETAIL_COLUMNS.map((key) => (
            <ColumnCheck
              key={key}
              label={RUN_COLUMN_LABELS[key]}
              checked={columns[key]}
              onChange={(visible) => onChange(key, visible)}
            />
          ))}
        </ul>
        <p className="column-group-label">気象</p>
        <ul className="column-options">
          {WEATHER_RUN_COLUMNS.map((key) => (
            <ColumnCheck
              key={key}
              label={RUN_COLUMN_LABELS[key]}
              checked={columns[key]}
              onChange={(visible) => onChange(key, visible)}
            />
          ))}
        </ul>
        <div className="actions">
          <button type="button" className="button secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
