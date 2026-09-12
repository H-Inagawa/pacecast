"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { StickyActions } from "../../components/StickyActions";
import { WbgtPaceChart } from "../../components/WbgtPaceChart";
import { apiGet } from "../../lib/api";
import { wbgtPacePoints } from "../../lib/analyze";
import type { Run } from "../../lib/types";

export default function AnalyzePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Run[]>("/api/runs")
      .then((payload) => {
        setRuns(payload);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  const points = wbgtPacePoints(runs);

  return (
    <>
      <h1>分析結果</h1>
      <p className="lede">推定 WBGT と走行ペースの関係です。気象が付いていない走と、WBGT が無い走は含みません。</p>
      {error ? <p className="error">{error}</p> : null}
      {!loaded ? (
        <p className="empty">読み込み中...</p>
      ) : points.length === 0 ? (
        <p className="empty">WBGT 付きの走行がまだありません。</p>
      ) : (
        <>
          <p className="meta">WBGT 付きの走行: {points.length} 件</p>
          <div className="chart-frame">
            <WbgtPaceChart points={points} />
          </div>
        </>
      )}
      <StickyActions>
        <BackHome variant="button" />
      </StickyActions>
    </>
  );
}
