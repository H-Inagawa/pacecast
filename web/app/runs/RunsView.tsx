"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpTip, WBGT_HELP_TEXT } from "../../components/WeatherDistanceHelp";
import { BackHome } from "../../components/BackHome";
import { RunColumnsModal } from "../../components/RunColumnsModal";
import { RunFormModal } from "../../components/RunFormModal";
import { StickyActions } from "../../components/StickyActions";
import { apiGet, apiSend } from "../../lib/api";
import {
  DEFAULT_RUN_COLUMNS,
  loadRunColumns,
  saveRunColumns,
  type OptionalRunColumn,
  type RunColumnVisibility,
} from "../../lib/runColumns";
import {
  formatDateTime,
  formatDistanceKm,
  formatDuration,
  formatHumidityPct,
  formatPace,
  formatRunSummary,
  formatTemperatureC,
  formatWbgtValue,
  groupRunsByMonth,
} from "../../lib/format";
import { runRowClass, type WbgtZone } from "../../lib/weatherZone";
import type { Run } from "../../lib/types";
import { ModalCloseButton } from "../../components/ModalCloseButton";

type Props = {
  initialEditId?: number;
};

const WBGT_LEGEND: { zone: WbgtZone; label: string }[] = [
  { zone: "too_hot", label: "暑すぎる" },
  { zone: "hot", label: "暑い" },
  { zone: "comfort", label: "快適" },
  { zone: "cold", label: "寒い" },
  { zone: "too_cold", label: "寒すぎる" },
  { zone: "none", label: "未適用" },
];

export function RunsView({ initialEditId }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formRunId, setFormRunId] = useState<number | null | undefined>(undefined);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<RunColumnVisibility>(DEFAULT_RUN_COLUMNS);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    try {
      setRuns(await apiGet<Run[]>("/api/runs"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
    setColumns(loadRunColumns());
  }, []);

  function setColumn(key: OptionalRunColumn, visible: boolean) {
    setColumns((current) => {
      const next = { ...current, [key]: visible };
      saveRunColumns(next);
      return next;
    });
  }

  useEffect(() => {
    if (initialEditId == null) {
      return;
    }
    setFormRunId(initialEditId);
    router.replace("/runs");
  }, [initialEditId, router]);

  async function confirmRemove() {
    if (deleteId == null) {
      return;
    }
    try {
      await apiSend(`/api/runs/${deleteId}`, "DELETE");
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      setDeleteId(null);
    }
  }

  const groups = groupRunsByMonth(runs);
  const formOpen = formRunId !== undefined;
  const totalDistance = runs.reduce((sum, run) => sum + run.distance_km, 0);
  const wbgtColoring = runs.some((run) => run.weather_zone != null);

  return (
    <>
      <header className="page-heading runs-heading">
        <h1>走行記録</h1>
        {loaded && groups.length ? <p className="meta">{formatRunSummary(runs.length, totalDistance)}</p> : null}
        {loaded && !groups.length ? <p className="meta">記録がありません</p> : null}
      </header>
      {error ? <p className="error">{error}</p> : null}
      {wbgtColoring ? (
        <div className="wbgt-legend" role="list" aria-label="WBGTの凡例">
          <span className="wbgt-legend__label">凡例:</span>
          {WBGT_LEGEND.map((item) => (
            <span key={item.zone} role="listitem" className={`wbgt-legend__chip wbgt-${item.zone}`}>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {!loaded ? (
        <p className="empty">読み込み中...</p>
      ) : groups.length ? (
        groups.map((group) => (
          <section className="month-block" key={group.key}>
            <div className="month-head">
              <h2>{group.label}</h2>
              <p className="meta">{formatRunSummary(group.runs.length, group.total)}</p>
            </div>
            <div className="runs-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>距離</th>
                  {columns.duration ? <th>走行時間</th> : null}
                  {columns.pace ? <th>ペース</th> : null}
                  {columns.heart_rate ? <th>平均心拍数</th> : null}
                  {columns.temperature ? <th>気温</th> : null}
                  {columns.humidity ? <th>湿度</th> : null}
                  {columns.wbgt ? (
                    <th>
                      <HelpTip label="WBGT" text={WBGT_HELP_TEXT} ariaLabel="WBGTの説明" />
                    </th>
                  ) : null}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.runs.map((run) => (
                  <tr key={run.id} className={runRowClass(run)}>
                    <td>{formatDateTime(run.started_at)}</td>
                    <td>{formatDistanceKm(run.distance_km)}</td>
                    {columns.duration ? <td>{formatDuration(run.duration_sec)}</td> : null}
                    {columns.pace ? <td>{formatPace(run.pace_sec_per_km)}</td> : null}
                    {columns.heart_rate ? (
                      <td>{run.avg_heart_rate == null ? "—" : `${run.avg_heart_rate}bpm`}</td>
                    ) : null}
                    {columns.temperature ? <td>{formatTemperatureC(run.weather)}</td> : null}
                    {columns.humidity ? <td>{formatHumidityPct(run.weather)}</td> : null}
                    {columns.wbgt ? <td>{formatWbgtValue(run.weather)}</td> : null}
                    <td className="row-actions">
                      <button type="button" className="text-link" onClick={() => setFormRunId(run.id)}>
                        編集
                      </button>
                      <button type="button" className="linkish" onClick={() => setDeleteId(run.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        ))
      ) : (
        <p className="empty">
          <button type="button" className="text-link" onClick={() => setFormRunId(null)}>
            最初の走行を追加
          </button>
        </p>
      )}
      {formOpen ? null : (
        <StickyActions layout="settings-main-home">
          <button type="button" className="button columns-settings" onClick={() => setColumnsOpen(true)}>
            表示項目設定
          </button>
          <button type="button" className="button action-lg" onClick={() => setFormRunId(null)}>
            記録を追加
          </button>
          <BackHome variant="button" />
        </StickyActions>
      )}
      <RunColumnsModal
        open={columnsOpen}
        columns={columns}
        onChange={setColumn}
        onClose={() => setColumnsOpen(false)}
      />
      <RunFormModal
        open={formOpen}
        runId={formRunId ?? undefined}
        onClose={() => setFormRunId(undefined)}
        onSaved={() => void load()}
      />
      {deleteId != null ? (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)} role="presentation">
          <div
            className="modal-panel delete-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-run-title"
            onClick={(event) => event.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setDeleteId(null)} />
            <p id="delete-run-title" className="delete-confirm__title">
              記録を削除してよろしいですか？
            </p>
            <div className="delete-confirm__actions">
              <button type="button" className="button danger" onClick={() => void confirmRemove()}>
                削除
              </button>
              <button type="button" className="button ghost" onClick={() => setDeleteId(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
