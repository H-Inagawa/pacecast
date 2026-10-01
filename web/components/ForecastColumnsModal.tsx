"use client";

import { useEffect } from "react";
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
  onChange: (key: OptionalForecastColumn, visible: boolean) => void;
  onClose: () => void;
};

export function ForecastColumnsModal({ open, columns, onChange, onClose }: Props) {
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
                <input type="checkbox" checked={columns[key]} onChange={(event) => onChange(key, event.target.checked)} />
                {FORECAST_COLUMN_LABELS[key]}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
