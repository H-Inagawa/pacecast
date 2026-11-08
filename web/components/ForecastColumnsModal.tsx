"use client";

import {
  FORECAST_COLUMN_LABELS,
  FORECAST_OPTIONAL_COLUMNS,
  FORECAST_REQUIRED_COLUMNS,
  type ForecastColumnVisibility,
} from "../lib/forecastColumns";
import { ColumnsSettingsModal } from "./ColumnsSettingsModal";

type Props = {
  open: boolean;
  columns: ForecastColumnVisibility;
  onSave: (columns: ForecastColumnVisibility) => void;
  onClose: () => void;
};

const ROWS = [
  ...FORECAST_REQUIRED_COLUMNS.map((key) => ({
    key,
    label: `${FORECAST_COLUMN_LABELS[key]}（必須）`,
    required: true as const,
  })),
  ...FORECAST_OPTIONAL_COLUMNS.map((key) => ({
    key,
    label: FORECAST_COLUMN_LABELS[key],
  })),
];

export function ForecastColumnsModal({ open, columns, onSave, onClose }: Props) {
  return (
    <ColumnsSettingsModal
      open={open}
      titleId="forecast-columns-title"
      columns={columns}
      rows={ROWS}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
