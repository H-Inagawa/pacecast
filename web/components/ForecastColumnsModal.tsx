"use client";

import { useEffect, useState } from "react";
import {
  FORECAST_COLUMN_LABELS,
  FORECAST_OPTIONAL_COLUMNS,
  FORECAST_REQUIRED_COLUMNS,
  type ForecastColumnVisibility,
  type OptionalForecastColumn,
} from "../lib/forecastColumns";
import { ModalCloseButton } from "./ModalCloseButton";

type Props = {
  open: boolean;
  columns: ForecastColumnVisibility;
  onSave: (columns: ForecastColumnVisibility) => void;
  onClose: () => void;
};

export function ForecastColumnsModal({ open, columns, onSave, onClose }: Props) {
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

  function setVisible(key: OptionalForecastColumn, visible: boolean) {
    setDraft((current) => ({ ...current, [key]: visible }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel modal-panel--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-columns-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <h2 id="forecast-columns-title">表示項目設定</h2>
        <ul className="column-options">
          {FORECAST_REQUIRED_COLUMNS.map((key) => (
            <li key={key}>
              <label className="choice">
                <input type="checkbox" checked disabled />
                {FORECAST_COLUMN_LABELS[key]}（必須）
              </label>
            </li>
          ))}
          {FORECAST_OPTIONAL_COLUMNS.map((key) => (
            <li key={key}>
              <label className="choice">
                <input type="checkbox" checked={draft[key]} onChange={(event) => setVisible(key, event.target.checked)} />
                {FORECAST_COLUMN_LABELS[key]}
              </label>
            </li>
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
