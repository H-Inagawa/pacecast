"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { ForecastColumnsModal } from "../../components/ForecastColumnsModal";
import { ForecastTimeline } from "../../components/ForecastTimeline";
import { StationPicker } from "../../components/StationPicker";
import { StickyActions } from "../../components/StickyActions";
import { apiGet } from "../../lib/api";
import {
  loadForecastColumns,
  saveForecastColumns,
  visibleForecastCount,
  DEFAULT_FORECAST_COLUMNS,
  type ForecastColumnVisibility,
  type OptionalForecastColumn,
} from "../../lib/forecastColumns";
import { pickCurrentForecastHour } from "../../lib/runningForecast";
import { formatWindWithDirection } from "../../lib/wind";
import type { AmedasStation, Profile, RunningForecast } from "../../lib/types";

export default function ForecastPage() {
  const [stations, setStations] = useState<AmedasStation[]>([]);
  const [stationId, setStationId] = useState("44132");
  const [forecast, setForecast] = useState<RunningForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
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
      if (!visible && visibleForecastCount(next) < 1) {
        return current;
      }
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
      <p className="lede">これから3日の天気と推定 WBGT を見て、走りやすい時間を選びます。</p>
      <StationPicker stations={stations} value={stationId} onChange={setStationId} />
      {error ? <p className="error">{error}</p> : null}
      {!loaded ? (
        <p className="empty">読み込み中...</p>
      ) : forecast == null || forecast.hours.length === 0 ? (
        <p className="empty">予報がまだありません。</p>
      ) : (
        <>
          {currentHour ? (
            <div className="forecast-now-block">
              <h2 className="forecast-now-title">現在の気象</h2>
              <ul className="forecast-now">
                <li>天気: {currentHour.weather_label}</li>
                <li>体感: {currentHour.feel_label}</li>
                <li>WBGT: {currentHour.wbgt_c.toFixed(1)}℃</li>
                <li>気温: {currentHour.temperature_c.toFixed(1)}℃</li>
                <li>湿度: {currentHour.humidity_pct.toFixed(0)}%</li>
                <li>風速: {formatWindWithDirection(currentHour.wind_ms, currentHour.wind_dir_deg)}</li>
                <li>日照: {currentHour.solar_wm2.toFixed(0)}</li>
              </ul>
            </div>
          ) : null}
          <ForecastTimeline hours={forecast.hours} columns={columns} />
        </>
      )}
      <StickyActions>
        <button type="button" className="button action-lg" onClick={() => setColumnsOpen(true)}>
          表示項目設定
        </button>
        <BackHome variant="button" />
      </StickyActions>
      <ForecastColumnsModal
        open={columnsOpen}
        columns={columns}
        onChange={setColumn}
        onClose={() => setColumnsOpen(false)}
      />
    </>
  );
}
