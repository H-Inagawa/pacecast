"use client";

import {
  RUN_COLUMN_LABELS,
  RUN_DETAIL_COLUMNS,
  WEATHER_RUN_COLUMNS,
  type RunColumnVisibility,
} from "../lib/runColumns";
import { ColumnsSettingsModal } from "./ColumnsSettingsModal";

type Props = {
  open: boolean;
  columns: RunColumnVisibility;
  onSave: (columns: RunColumnVisibility) => void;
  onClose: () => void;
};

const ROWS = [
  { key: "started_at", label: RUN_COLUMN_LABELS.started_at, required: true },
  { key: "distance", label: RUN_COLUMN_LABELS.distance, required: true },
  ...RUN_DETAIL_COLUMNS.map((key) => ({ key, label: RUN_COLUMN_LABELS[key] })),
  ...WEATHER_RUN_COLUMNS.map((key) => ({ key, label: RUN_COLUMN_LABELS[key] })),
];

export function RunColumnsModal({ open, columns, onSave, onClose }: Props) {
  return (
    <ColumnsSettingsModal
      open={open}
      titleId="run-columns-title"
      columns={columns}
      rows={ROWS}
      onSave={onSave}
      onClose={onClose}
      description={<p className="muted">日時と距離は常に表示します。それ以外の列を選べます。</p>}
      groups={[
        { label: "走行詳細", beforeKey: RUN_DETAIL_COLUMNS[0] },
        { label: "気象", beforeKey: WEATHER_RUN_COLUMNS[0] },
      ]}
      backdropClassName="modal-backdrop modal-backdrop--wide"
      panelClassName="modal-panel modal-panel--wide modal-panel--compact"
    />
  );
}
