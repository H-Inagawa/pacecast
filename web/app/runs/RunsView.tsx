"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpTip, WBGT_HELP_TEXT } from "../../components/WeatherDistanceHelp";
import { BackHome } from "../../components/BackHome";
import { RunFormModal } from "../../components/RunFormModal";
import { StickyActions } from "../../components/StickyActions";
import { apiGet, apiSend } from "../../lib/api";
import { formatDateTime, formatDistanceKm, formatDuration, formatPace, formatRunSummary, formatWeatherBrief, groupRunsByMonth } from "../../lib/format";
import { runRowClass, WBGT_ZONE_LABELS } from "../../lib/weatherZone";
import type { Run } from "../../lib/types";

type Props = {
  initialEditId?: number;
};

export function RunsView({ initialEditId }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formRunId, setFormRunId] = useState<number | null | undefined>(undefined);

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
  }, []);

  useEffect(() => {
    if (initialEditId == null) {
      return;
    }
    setFormRunId(initialEditId);
    router.replace("/runs");
  }, [initialEditId, router]);

  async function remove(id: number) {
    if (!window.confirm("記録を削除してよろしいですか？")) {
      return;
    }
    await apiSend(`/api/runs/${id}`, "DELETE");
    await load();
  }

  const groups = groupRunsByMonth(runs);
  const formOpen = formRunId !== undefined;
  const totalDistance = runs.reduce((sum, run) => sum + run.distance_km, 0);
  const wbgtColoring = runs.some((run) => run.weather_zone != null);

  return (
    <>
      <header className="page-heading">
        <h1>走行記録</h1>
        {loaded ? <p className="meta">{formatRunSummary(runs.length, totalDistance)}</p> : null}
      </header>
      {error ? <p className="error">{error}</p> : null}
      {wbgtColoring ? (
        <p className="meta weather-legend">
          行の色は推定 WBGT。{WBGT_ZONE_LABELS.too_cold} / {WBGT_ZONE_LABELS.cold} / {WBGT_ZONE_LABELS.comfort} /{" "}
          {WBGT_ZONE_LABELS.hot} / {WBGT_ZONE_LABELS.too_hot}。{WBGT_ZONE_LABELS.none}はグレー。
        </p>
      ) : null}
      {!loaded ? (
        <p className="empty">読み込み中...</p>
      ) : groups.length ? (
        groups.map((group) => (
          <section className="month-block" key={group.key}>
            <h2>{group.label}</h2>
            <p className="meta">{formatRunSummary(group.runs.length, group.total)}</p>
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>距離</th>
                  <th>走行時間</th>
                  <th>ペース</th>
                  <th>平均心拍数</th>
                  <th>
                    <HelpTip label="気象" text={WBGT_HELP_TEXT} ariaLabel="WBGTの説明" />
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.runs.map((run) => (
                  <tr key={run.id} className={runRowClass(run)}>
                    <td>{formatDateTime(run.started_at)}</td>
                    <td>{formatDistanceKm(run.distance_km)}</td>
                    <td>{formatDuration(run.duration_sec)}</td>
                    <td>{formatPace(run.pace_sec_per_km)}</td>
                    <td>{run.avg_heart_rate == null ? "—" : `${run.avg_heart_rate}bpm`}</td>
                    <td>{formatWeatherBrief(run.weather)}</td>
                    <td className="row-actions">
                      <button type="button" className="text-link" onClick={() => setFormRunId(run.id)}>
                        編集
                      </button>
                      <button type="button" className="linkish" onClick={() => void remove(run.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      ) : (
        <p className="empty">
          記録がありません。
          <button type="button" className="text-link" onClick={() => setFormRunId(null)}>
            最初の走行を追加
          </button>
          してください。
        </p>
      )}
      {formOpen ? null : (
        <StickyActions>
          <button type="button" className="button action-lg" onClick={() => setFormRunId(null)}>
            記録を追加
          </button>
          <BackHome variant="button" />
        </StickyActions>
      )}
      <RunFormModal
        open={formOpen}
        runId={formRunId ?? undefined}
        onClose={() => setFormRunId(undefined)}
        onSaved={() => void load()}
      />
    </>
  );
}
