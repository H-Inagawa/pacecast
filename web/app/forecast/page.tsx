"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { ForecastColumnsModal } from "../../components/ForecastColumnsModal";
import { ForecastNowTable, ForecastTimeline } from "../../components/ForecastTimeline";
import { RunnabilityModal } from "../../components/RunnabilityModal";
import { StationPicker } from "../../components/StationPicker";
import { StickyActions } from "../../components/StickyActions";
import { apiGet } from "../../lib/api";
import {
  loadForecastColumns,
  saveForecastColumns,
  DEFAULT_FORECAST_COLUMNS,
  type ForecastColumnVisibility,
  type OptionalForecastColumn,
} from "../../lib/forecastColumns";
import { pickCurrentForecastHour } from "../../lib/runningForecast";
import type { AmedasStation, Profile, RunningForecast } from "../../lib/types";

export default function ForecastPage() {
  const [stations, setStations] = useState<AmedasStation[]>([]);
  const [stationId, setStationId] = useState("44132");
  const [forecast, setForecast] = useState<RunningForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [columns, setColumns] = useState<ForecastColumnVisibility>(DEFAULT_FORECAST_COLUMNS);

  useEffect(() => {
    setColumns(loadForecastColumns());
    void Promise.all([apiGet<Profile>("/api/profile"), apiGet<AmedasStation[]>("/api/amedas/stations")]).then(
      ([profile, amedasStations]) => {
        setStations(amedasStations);
        setStationId(profile.amedas_station_id || "44132");
      },
    );
  }, []);

  useEffect(() => {
    if (!stationId) {
      return;
    }
    setLoaded(false);
    setError(null);
    void apiGet<RunningForecast>(`/api/forecast?station_id=${encodeURIComponent(stationId)}`)
      .then((payload) => {
        setForecast(payload);
      })
      .catch((err) => {
        setForecast(null);
        setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      })
      .finally(() => {
        setLoaded(true);
      });
  }, [stationId]);

  function setColumn(key: OptionalForecastColumn, visible: boolean) {
    setColumns((current) => {
      const next = { ...current, [key]: visible };
      saveForecastColumns(next);
      return next;
    });
  }

  const currentHour = forecast ? pickCurrentForecastHour(forecast.hours) : null;

  return (
    <>
      <div className="page-heading">
        <h1>ランニング天気予報</h1>
      </div>
      <p className="lede">走りやすい時間を確認します。</p>
      <StationPicker stations={stations} value={stationId} onChange={setStationId} allowGps clearOnPrefecture />
      {error ? <p className="error">{error}</p> : null}
      {!loaded ? (
        <p className="empty">読み込み中...</p>
      ) : forecast == null || forecast.hours.length === 0 ? (
        <p className="empty">予報がまだありません。</p>
      ) : (
        <>
          {currentHour ? <ForecastNowTable hour={currentHour} /> : null}
          <ForecastTimeline hours={forecast.hours} columns={columns} />
        </>
      )}
      <div className="forecast-dock">
        <button type="button" className="button" onClick={() => setColumnsOpen(true)}>
          表示項目設定
        </button>
        <button type="button" className="button" onClick={() => setScoreOpen(true)}>
          走りやすさとは？
        </button>
      </div>
      <StickyActions>
        <BackHome variant="button" />
      </StickyActions>
      <ForecastColumnsModal
        open={columnsOpen}
        columns={columns}
        onChange={setColumn}
        onClose={() => setColumnsOpen(false)}
      />
      <RunnabilityModal open={scoreOpen} onClose={() => setScoreOpen(false)} />
    </>
  );
}
