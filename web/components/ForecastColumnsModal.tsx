"use client";

import { useEffect } from "react";
import {
  FORECAST_COLUMN_LABELS,
  FORECAST_OPTIONAL_COLUMNS,
  visibleForecastCount,
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

  const remaining = visibleForecastCount(columns);

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
        <p className="lede">表に出す列を選びます。日時は必ず表示します。最低1項目は残してください。</p>
        <ul className="column-options">
          <li>
            <label className="choice">
              <input type="checkbox" checked disabled />
              {FORECAST_COLUMN_LABELS.observed_at}
            </label>
          </li>
          {FORECAST_OPTIONAL_COLUMNS.map((key) => {
            const lastOn = columns[key] && remaining <= 1;
            return (
              <li key={key}>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={columns[key]}
                    disabled={lastOn}
                    onChange={(event) => onChange(key, event.target.checked)}
                  />
                  {FORECAST_COLUMN_LABELS[key]}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
