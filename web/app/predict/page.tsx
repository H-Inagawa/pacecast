"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { StickyActions } from "../../components/StickyActions";
import { WeatherDistanceHelp } from "../../components/WeatherDistanceHelp";
import { apiGet, apiSend } from "../../lib/api";
import { confidenceLabel, defaultDateTimeLocal, formatDateTime, formatDistanceKm, formatDuration, formatPace, formatWbgtDelta, formatWeatherBrief } from "../../lib/format";
import type { PredictResult, Profile } from "../../lib/types";

const RACE_LABELS: Record<string, string> = {
  race_5k: "5km",
  race_10k: "10km",
  race_half: "ハーフマラソン(21.0975km)",
  race_full: "フルマラソン(42.195km)",
};

export default function PredictPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"manual" | "forecast" | null>(null);
  const [distanceMode, setDistanceMode] = useState<"custom" | "race" | null>(null);
  const [distanceKm, setDistanceKm] = useState("5.0");
  const [race, setRace] = useState("race_5k");
  const [temperature, setTemperature] = useState("20.0");
  const [humidity, setHumidity] = useState("60");
  const [forecastAt, setForecastAt] = useState(defaultDateTimeLocal());
  const [intensity, setIntensity] = useState("medium");
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Profile>("/api/profile").then(setProfile);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (distanceMode == null) {
      setError("距離の指定方法を選んでください");
      return;
    }
    if (mode == null) {
      setError("気象条件の指定方法を選んでください");
      return;
    }
    try {
      const payload = await apiSend<PredictResult>("/api/predict", "POST", {
        distance_km: distanceMode === "custom" ? Number(distanceKm) : undefined,
        distance_mode: distanceMode,
        race,
        mode,
        temperature_c: Number(temperature),
        humidity_pct: Number(humidity),
        forecast_at: forecastAt,
        intensity,
      });
      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "予測に失敗しました");
    }
  }

  const customOn = distanceMode === "custom";
  const raceOn = distanceMode === "race";
  const manualOn = mode === "manual";
  const forecastOn = mode === "forecast";

  return (
    <>
      <h1>パフォーマンス予測</h1>
      <p className="lede">気象条件と走行強度を指定して、過去走からペース・タイムを見積もります。</p>
      {error ? <p className="error">{error}</p> : null}
      <form id="predict-form" className="stack" onSubmit={(event) => void onSubmit(event)}>
        <p className="meta">距離の指定方法</p>
        <label className="choice">
          <input type="radio" name="distance-mode" checked={customOn} onChange={() => setDistanceMode("custom")} />
          距離を指定して予測
        </label>
        <div className={customOn ? "mode-card active" : "mode-card inactive"}>
          <label>
            距離（km）
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={distanceKm}
              onChange={(event) => setDistanceKm(event.target.value)}
              disabled={!customOn}
              required={customOn}
            />
          </label>
          <label>
            走行強度
            <select value={intensity} onChange={(event) => setIntensity(event.target.value)} disabled={!customOn}>
              {(profile?.custom_intensities ?? []).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="choice">
          <input type="radio" name="distance-mode" checked={raceOn} onChange={() => setDistanceMode("race")} />
          レース種別で予測
        </label>
        <div className={raceOn ? "mode-card active" : "mode-card inactive"}>
          {Object.entries(RACE_LABELS).map(([key, label]) => (
            <label className="choice" key={key}>
              <input type="radio" name="race" checked={race === key} onChange={() => setRace(key)} disabled={!raceOn} />
              {label}
            </label>
          ))}
        </div>

        <p className="meta">気象条件の指定方法</p>
        <label className="choice">
          <input type="radio" name="mode" checked={manualOn} onChange={() => setMode("manual")} />
          気温・湿度を入力する
        </label>
        <div className={manualOn ? "mode-card active" : "mode-card inactive"}>
          <div className="split">
            <label>
              気温（℃）
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                disabled={!manualOn}
              />
            </label>
            <label>
              湿度（％）
              <input
                type="number"
                min="0"
                max="100"
                value={humidity}
                onChange={(event) => setHumidity(event.target.value)}
                disabled={!manualOn}
              />
            </label>
          </div>
        </div>
        <label className="choice">
          <input type="radio" name="mode" checked={forecastOn} onChange={() => setMode("forecast")} />
          日時を指定して予報を使う（練馬）
        </label>
        <div className={forecastOn ? "mode-card active" : "mode-card inactive"}>
          <label>
            予報を使う日時
            <input
              type="datetime-local"
              value={forecastAt}
              onChange={(event) => setForecastAt(event.target.value)}
              disabled={!forecastOn}
            />
          </label>
        </div>
      </form>

      {result ? (
        <>
          {result.condition ? (
            <p className="meta">
              予報: {result.condition.location_label} {formatDateTime(result.condition.observed_at)} / {result.condition.temperature_c.toFixed(1)}℃ /{" "}
              {result.condition.humidity_pct.toFixed(0)}%
              {result.condition.wbgt_c != null ? ` / WBGT ${result.condition.wbgt_c.toFixed(1)}℃` : ""}
            </p>
          ) : null}
          <p className="meta">走行強度: {result.intensity_label}</p>
          <section className="stat-grid">
            <article className="card">
              <h2>予想ペース</h2>
              <p className="stat">{formatPace(result.predicted_pace_sec_per_km)}</p>
            </article>
            <article className="card">
              <h2>予想タイム</h2>
              <p className="stat">{formatDuration(result.predicted_duration_sec)}</p>
            </article>
          </section>
          <p className="meta">
            信頼度: {confidenceLabel(result.confidence)} / 使用した過去走 {result.sample_count} 件（近い条件 {result.near_count} 件）
          </p>
          <h2>根拠にした過去走</h2>
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>距離</th>
                <th>ペース</th>
                <th>心拍</th>
                <th>当時の気象</th>
                <th>
                  <WeatherDistanceHelp text={result.weather_distance_help} />
                </th>
              </tr>
            </thead>
            <tbody>
              {result.used_runs.map((run) => (
                <tr key={run.record_id}>
                  <td>{formatDateTime(run.started_at)}</td>
                  <td>{formatDistanceKm(run.distance_km)}</td>
                  <td>{formatPace(run.pace_sec_per_km)}</td>
                  <td>{run.avg_heart_rate ?? "—"}</td>
                  <td>
                    {formatWeatherBrief({
                      temperature_c: run.temperature_c,
                      humidity_pct: run.humidity_pct,
                      wbgt_c: run.wbgt_c,
                    })}
                  </td>
                  <td>{formatWbgtDelta(run.wbgt_delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      <StickyActions>
        <button type="submit" className="button action-lg" form="predict-form">
          予測する
        </button>
        <BackHome variant="button" />
      </StickyActions>
    </>
  );
}
