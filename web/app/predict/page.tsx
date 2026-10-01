"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { ModalCloseButton } from "../../components/ModalCloseButton";
import { PredictHelpModal } from "../../components/PredictHelpModal";
import { RelationChart } from "../../components/RelationChart";
import { StationPicker } from "../../components/StationPicker";
import { StickyActions } from "../../components/StickyActions";
import { HelpTip } from "../../components/WeatherDistanceHelp";
import { apiGet, apiSend } from "../../lib/api";
import {
  confidenceLabel,
  defaultDateTimeLocal,
  formatDateTime,
  formatDistanceKm,
  formatDurationRange,
  formatPace,
  formatPaceRange,
  formatSimilarity,
  formatWeatherBrief,
} from "../../lib/format";
import { formatWindWithDirection } from "../../lib/wind";
import { formatRunnability, formatWbgtFeel, formatWeatherWithMark } from "../../lib/runnability";
import { weatherCodeLabel } from "../../lib/weatherCode";
import { RUN_WEIGHT_HELP } from "../../lib/personalPredict";
import { classifyWbgtZone, WBGT_FEEL_LABELS } from "../../lib/weatherZone";
import type { AmedasStation, PredictResult, Profile } from "../../lib/types";

const RACE_LABELS: Record<string, string> = {
  race_5k: "5km",
  race_10k: "10km",
  race_half: "ハーフマラソン(21.0975km)",
  race_full: "フルマラソン(42.195km)",
};

const DISTANCE_INTENSITY = [
  { key: "low", label: "楽" },
  { key: "medium", label: "中" },
  { key: "high", label: "きつい" },
] as const;

type DistanceDraft = {
  mode: "custom" | "race";
  km: string;
  race: string;
  intensity: string;
};

type WeatherDraft = {
  mode: "manual" | "forecast";
  temperature: string;
  humidity: string;
  forecastAt: string;
  stationId: string;
};

function formatEffectPercent(effect: number): string {
  const percent = effect * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

function personalEffectLabel(general: number, finalEffect: number, alpha: number): string {
  const percent = formatEffectPercent(finalEffect);
  if (!(alpha > 0)) {
    return percent;
  }
  const delta = (finalEffect - general) * 100;
  if (Math.abs(delta) < 0.05) {
    return percent;
  }
  const direction = delta > 0 ? "遅くなる" : "速くなる";
  return `${percent} (一般より${Math.abs(delta).toFixed(1)}%${direction})`;
}

function intensityLabel(key: string): string {
  return DISTANCE_INTENSITY.find((item) => item.key === key)?.label ?? key;
}

function formatForecastChoice(value: string): string {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return `${value}（予報）`;
  }
  return `${Number(match[2])}/${Number(match[3])} ${Number(match[4])}:${match[5]}（予報）`;
}

function weatherSummary(saved: WeatherDraft | null, result: PredictResult | null): string {
  if (saved?.mode === "forecast" && result?.condition) {
    const condition = result.condition;
    const zone = classifyWbgtZone(condition.wbgt_c);
    const feel = zone === "none" ? "—" : WBGT_FEEL_LABELS[zone];
    const wind = condition.wind_ms == null ? "—" : formatWindWithDirection(condition.wind_ms, condition.wind_dir_deg);
    const solar = condition.solar_wm2 == null ? "—" : String(Math.round(condition.solar_wm2));
    const weather = weatherCodeLabel(condition.weather_code);
    const wbgt = condition.wbgt_c == null ? "—" : formatWbgtFeel(condition.wbgt_c, feel);
    const ease = condition.wbgt_c == null ? "—" : formatRunnability(condition.wbgt_c, weather);
    return [
      `走りやすさ: ${ease}`,
      `天気: ${formatWeatherWithMark(weather)}`,
      `WBGT(体感): ${wbgt}`,
      `気温: ${condition.temperature_c.toFixed(1)}℃`,
      `湿度: ${condition.humidity_pct.toFixed(0)}%`,
      `風速: ${wind}`,
      `日照: ${solar}`,
    ].join("\n");
  }
  if (!saved) {
    return "設定してください";
  }
  if (saved.mode === "manual") {
    return `気温 ${Number(saved.temperature).toFixed(1)}℃ / 湿度 ${Number(saved.humidity).toFixed(0)}%`;
  }
  return formatForecastChoice(saved.forecastAt);
}

function distanceSummary(saved: DistanceDraft | null): string {
  if (!saved) {
    return "設定してください";
  }
  if (saved.mode === "race") {
    return RACE_LABELS[saved.race] ?? saved.race;
  }
  return `${Number(saved.km).toFixed(2)} km / 走行強度: ${intensityLabel(saved.intensity)}`;
}

export default function PredictPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stations, setStations] = useState<AmedasStation[]>([]);
  const [savedDistance, setSavedDistance] = useState<DistanceDraft | null>(null);
  const [savedWeather, setSavedWeather] = useState<WeatherDraft | null>(null);
  const [distanceDraft, setDistanceDraft] = useState<DistanceDraft | null>(null);
  const [weatherDraft, setWeatherDraft] = useState<WeatherDraft | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    void Promise.all([apiGet<Profile>("/api/profile"), apiGet<AmedasStation[]>("/api/amedas/stations")]).then(
      ([nextProfile, amedasStations]) => {
        setProfile(nextProfile);
        setStations(amedasStations);
      },
    );
  }, []);

  const ready = savedDistance != null && savedWeather != null;

  function openDistance() {
    setDistanceDraft(
      savedDistance ?? {
        mode: "custom",
        km: "10.00",
        race: "race_10k",
        intensity: "medium",
      },
    );
    setDistanceError(null);
  }

  function openWeather() {
    setWeatherDraft(
      savedWeather ?? {
        mode: "manual",
        temperature: "24.0",
        humidity: "65",
        forecastAt: defaultDateTimeLocal(),
        stationId: profile?.amedas_station_id || "44132",
      },
    );
    setWeatherError(null);
  }

  function commitDistance() {
    if (!distanceDraft) {
      return;
    }
    if (distanceDraft.mode === "custom" && !(Number(distanceDraft.km) > 0)) {
      setDistanceError("距離は 0 より大きくしてください");
      return;
    }
    setSavedDistance(distanceDraft);
    setDistanceDraft(null);
    setResult(null);
    setError(null);
  }

  function commitWeather() {
    if (!weatherDraft) {
      return;
    }
    if (weatherDraft.mode === "manual") {
      const humidity = Number(weatherDraft.humidity);
      if (weatherDraft.temperature.trim() === "" || weatherDraft.humidity.trim() === "") {
        setWeatherError("気温と湿度を入力してください");
        return;
      }
      if (!(humidity >= 0 && humidity <= 100)) {
        setWeatherError("湿度は 0〜100 の範囲で入力してください");
        return;
      }
    } else if (!weatherDraft.forecastAt) {
      setWeatherError("予報の日時を選んでください");
      return;
    }
    setSavedWeather(weatherDraft);
    setWeatherDraft(null);
    setResult(null);
    setError(null);
  }

  async function onSubmit() {
    if (!savedDistance || !savedWeather) {
      return;
    }
    setError(null);
    try {
      const payload = await apiSend<PredictResult>("/api/predict", "POST", {
        distance_km: savedDistance.mode === "custom" ? Number(savedDistance.km) : undefined,
        distance_mode: savedDistance.mode,
        race: savedDistance.race,
        mode: savedWeather.mode,
        temperature_c: Number(savedWeather.temperature),
        humidity_pct: Number(savedWeather.humidity),
        forecast_at: savedWeather.forecastAt,
        intensity: savedDistance.intensity,
        amedas_station_id: savedWeather.mode === "forecast" ? savedWeather.stationId : undefined,
      });
      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "予測に失敗しました");
    }
  }

  const weatherText = weatherSummary(savedWeather, result);
  const distanceText = distanceSummary(savedDistance);

  return (
    <>
      <header className="page-heading">
        <h1>パフォーマンス予測</h1>
        <button type="button" className="heading-help" onClick={() => setHelpOpen(true)}>
          予測の見方
        </button>
      </header>
      <p className="lede">気象条件と走行強度を指定して、過去走からペース・タイムを見積もります。</p>
      <PredictHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {error ? <p className="error">{error}</p> : null}

      <section className="predict-card" aria-label="気象の指定">
        <h2>気象の指定</h2>
        <p className={savedWeather ? "predict-card__value" : "predict-card__value is-unset"}>{weatherText}</p>
        <button type="button" className="button" onClick={openWeather}>
          設定する
        </button>
      </section>
      <section className="predict-card" aria-label="距離/レースを指定">
        <h2>距離/レースを指定</h2>
        <p className={savedDistance ? "predict-card__value" : "predict-card__value is-unset"}>{distanceText}</p>
        <button type="button" className="button" onClick={openDistance}>
          設定する
        </button>
      </section>

      {result ? (
        <>
          <section className="stat-grid">
            <article className="card">
              <h2>予想ペース</h2>
              <p className="stat stat-range">
                {formatPaceRange(result.predicted_pace_sec_per_km, result.rmse_sec_per_km)}
              </p>
            </article>
            <article className="card">
              <h2>予想タイム</h2>
              <p className="stat stat-range">
                {formatDurationRange(
                  result.predicted_duration_sec,
                  result.predicted_pace_sec_per_km > 0
                    ? result.rmse_sec_per_km * (result.predicted_duration_sec / result.predicted_pace_sec_per_km)
                    : 0,
                )}
              </p>
            </article>
          </section>
          {result.final_wbgt_effect != null && result.general_wbgt_effect != null ? (
            <div className="wbgt-effect">
              <table>
                <caption>WBGTによる補正率</caption>
                <thead>
                  <tr>
                    <th />
                    <th>一般</th>
                    <th>個人補正あり</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>WBGT補正率</th>
                    <td>{formatEffectPercent(result.general_wbgt_effect)}</td>
                    <td>
                      {personalEffectLabel(
                        result.general_wbgt_effect,
                        result.final_wbgt_effect,
                        result.personal_weight ?? 0,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          {result.model_note ? <p className="meta">{result.model_note}</p> : null}
          <p className="meta predict-metrics">
            信頼度 {confidenceLabel(result.confidence)} ・ 参考件数 {result.sample_count}件
            {result.class_sample_count != null ? `（この階級 ${result.class_sample_count}件）` : ""}
            {" ・ "}
            関係の強さ(R²): {result.r_squared.toFixed(2)}
          </p>
          <div className="relation-grid">
            {result.relation_charts.map((chart) => (
              <RelationChart key={chart.key} chart={chart} />
            ))}
          </div>
          {result.final_wbgt_effect != null ? <h2 className="predict-table-title">予測条件に近い走行記録</h2> : null}
          <div className="runs-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>距離</th>
                  <th>ペース</th>
                  <th>心拍</th>
                  <th>気象</th>
                  <th>
                    <HelpTip
                      label="予測条件との類似性"
                      text={
                        result.final_wbgt_effect != null
                          ? RUN_WEIGHT_HELP
                          : "100 が最大です。直近の走ほど大きくなります。"
                      }
                      ariaLabel="予測条件との類似性の説明"
                    />
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
                    <td>{formatSimilarity(run.weight ?? Number.NaN)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <StickyActions>
        <button type="button" className="button action-lg" disabled={!ready} onClick={() => void onSubmit()}>
          予測する
        </button>
        <BackHome variant="button" />
      </StickyActions>

      {weatherDraft ? (
        <div className="modal-backdrop" onClick={() => setWeatherDraft(null)} role="presentation">
          <div
            className="modal-panel predict-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weather-setting-title"
            onClick={(event) => event.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setWeatherDraft(null)} />
            <h2 id="weather-setting-title">気象の指定</h2>
            <div className="predict-modal-form">
              <label className="choice">
                <input
                  type="radio"
                  name="weather-mode"
                  checked={weatherDraft.mode === "manual"}
                  onChange={() => setWeatherDraft({ ...weatherDraft, mode: "manual" })}
                />
                数値を入れる
              </label>
              <div className={weatherDraft.mode === "manual" ? "mode-card active" : "mode-card inactive"}>
                <label>
                  気温
                  <input
                    type="number"
                    step="0.1"
                    value={weatherDraft.temperature}
                    onChange={(event) => setWeatherDraft({ ...weatherDraft, temperature: event.target.value })}
                    disabled={weatherDraft.mode !== "manual"}
                  />
                </label>
                <label>
                  湿度
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weatherDraft.humidity}
                    onChange={(event) => setWeatherDraft({ ...weatherDraft, humidity: event.target.value })}
                    disabled={weatherDraft.mode !== "manual"}
                  />
                </label>
              </div>
              <label className="choice">
                <input
                  type="radio"
                  name="weather-mode"
                  checked={weatherDraft.mode === "forecast"}
                  onChange={() => setWeatherDraft({ ...weatherDraft, mode: "forecast" })}
                />
                予報から選ぶ
              </label>
              <div className={weatherDraft.mode === "forecast" ? "mode-card active" : "mode-card inactive"}>
                <StationPicker
                  stations={stations}
                  value={weatherDraft.stationId}
                  onChange={(stationId) => setWeatherDraft({ ...weatherDraft, stationId })}
                  disabled={weatherDraft.mode !== "forecast"}
                  label="アメダス"
                  allowGps
                  layout="run"
                  onGpsMessage={(message, kind) => setWeatherError(kind === "error" ? message : null)}
                />
                <label>
                  予報の日時
                  <input
                    type="datetime-local"
                    value={weatherDraft.forecastAt}
                    onChange={(event) => setWeatherDraft({ ...weatherDraft, forecastAt: event.target.value })}
                    disabled={weatherDraft.mode !== "forecast"}
                  />
                </label>
              </div>
              {weatherError ? <p className="error">{weatherError}</p> : null}
              <button type="button" className="button" onClick={commitWeather}>
                設定する
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {distanceDraft ? (
        <div className="modal-backdrop" onClick={() => setDistanceDraft(null)} role="presentation">
          <div
            className="modal-panel predict-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="distance-setting-title"
            onClick={(event) => event.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setDistanceDraft(null)} />
            <h2 id="distance-setting-title">距離/レースを指定</h2>
            <div className="predict-modal-form">
              <label className="choice">
                <input
                  type="radio"
                  name="distance-mode"
                  checked={distanceDraft.mode === "custom"}
                  onChange={() => setDistanceDraft({ ...distanceDraft, mode: "custom" })}
                />
                距離を指定
              </label>
              <div className={distanceDraft.mode === "custom" ? "mode-card active" : "mode-card inactive"}>
                <label>
                  距離（km）
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={distanceDraft.km}
                    onChange={(event) => setDistanceDraft({ ...distanceDraft, km: event.target.value })}
                    disabled={distanceDraft.mode !== "custom"}
                  />
                </label>
                {distanceDraft.mode === "custom" ? (
                  <fieldset className="predict-intensity">
                    <legend>走行強度</legend>
                    {DISTANCE_INTENSITY.map((item) => (
                      <label className="choice" key={item.key}>
                        <input
                          type="radio"
                          name="intensity"
                          checked={distanceDraft.intensity === item.key}
                          onChange={() => setDistanceDraft({ ...distanceDraft, intensity: item.key })}
                        />
                        {item.label}
                      </label>
                    ))}
                  </fieldset>
                ) : null}
              </div>
              <label className="choice">
                <input
                  type="radio"
                  name="distance-mode"
                  checked={distanceDraft.mode === "race"}
                  onChange={() => setDistanceDraft({ ...distanceDraft, mode: "race" })}
                />
                レース種別で予測
              </label>
              <div className={distanceDraft.mode === "race" ? "mode-card active" : "mode-card inactive"}>
                <label>
                  レース
                  <select
                    value={distanceDraft.race}
                    onChange={(event) => setDistanceDraft({ ...distanceDraft, race: event.target.value })}
                    disabled={distanceDraft.mode !== "race"}
                  >
                    {Object.entries(RACE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {distanceError ? <p className="error">{distanceError}</p> : null}
              <button type="button" className="button" onClick={commitDistance}>
                設定する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
