"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { StickyActions } from "../../components/StickyActions";
import { WeatherDistanceHelp } from "../../components/WeatherDistanceHelp";
import { apiGet, apiSend } from "../../lib/api";
import { confidenceLabel, defaultDateTimeLocal, formatDistanceKm, formatDuration, formatPace } from "../../lib/format";
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

  return (
    <>
      <h1>パフォーマンス予測</h1>
      <p className="lede">気象条件と走行強度を指定して、過去走からペース・タイム・心拍を見積もります。</p>
      {error ? <p className="error">{error}</p> : null}
      <form id="predict-form" className="stack" onSubmit={(event) => void onSubmit(event)}>
        <p className="meta">距離の指定方法</p>
        <label className="choice">
          <input type="radio" name="distance-mode" checked={distanceMode === "custom"} onChange={() => setDistanceMode("custom")} />
          距離を指定して予測
        </label>
        <label className="choice">
          <input type="radio" name="distance-mode" checked={distanceMode === "race"} onChange={() => setDistanceMode("race")} />
          レース種別で予測
        </label>
        {distanceMode === "custom" ? (
          <div className="mode-card active">
            <label>
              距離（km）
              <input type="number" min="0.01" step="0.01" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} required />
            </label>
            <label>
              走行強度
              <select value={intensity} onChange={(event) => setIntensity(event.target.value)}>
                {(profile?.custom_intensities ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {distanceMode === "race" ? (
          <div className="mode-card active">
            {Object.entries(RACE_LABELS).map(([key, label]) => (
              <label className="choice" key={key}>
                <input type="radio" name="race" checked={race === key} onChange={() => setRace(key)} />
                {label}
              </label>
            ))}
          </div>
        ) : null}

        <p className="meta">気象条件の指定方法</p>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === "manual"} onChange={() => setMode("manual")} />
          気温・湿度を入力する
        </label>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === "forecast"} onChange={() => setMode("forecast")} />
          日時を指定して予報を使う（練馬）
        </label>
        {mode === "manual" ? (
          <div className="mode-card active">
            <div className="split">
              <label>
                気温（℃）
                <input type="number" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
              </label>
              <label>
                湿度（％）
                <input type="number" min="0" max="100" value={humidity} onChange={(event) => setHumidity(event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}
        {mode === "forecast" ? (
          <div className="mode-card active">
            <label>
              予報を使う日時
              <input type="datetime-local" value={forecastAt} onChange={(event) => setForecastAt(event.target.value)} />
            </label>
          </div>
        ) : null}
      </form>

      {result ? (
        <>
          {result.condition ? (
            <p className="meta">
              予報: {result.condition.location_label} {result.condition.observed_at} / {result.condition.temperature_c.toFixed(1)}℃ /{" "}
              {result.condition.humidity_pct.toFixed(0)}%
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
                  <td>{run.started_at}</td>
                  <td>{formatDistanceKm(run.distance_km)}</td>
                  <td>{formatPace(run.pace_sec_per_km)}</td>
                  <td>{run.avg_heart_rate ?? "—"}</td>
                  <td>
                    {run.temperature_c.toFixed(1)}℃ / {run.humidity_pct.toFixed(0)}%
                  </td>
                  <td>{run.weather_distance.toFixed(2)}</td>
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
