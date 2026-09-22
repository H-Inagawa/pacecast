"use client";

import { useEffect, useMemo, useState } from "react";
import { prefectureFromStationId, prefecturesInStations } from "../lib/amedas-prefecture";
import { canUseGeolocation, geolocationUnavailableReason, requestCurrentPosition } from "../lib/geolocation";
import { nearestStation } from "../lib/nearest-station";
import type { AmedasStation } from "../lib/types";

type Props = {
  stations: AmedasStation[];
  value: string;
  onChange: (stationId: string) => void;
  disabled?: boolean;
  label?: string;
  allowGps?: boolean;
  /** 記録追加モーダル向け。地点名の下に都道府県と観測所を横並びにする。 */
  layout?: "stack" | "run";
  onGpsMessage?: (message: string, kind: "ok" | "error") => void;
};

export function StationPicker({
  stations,
  value,
  onChange,
  disabled = false,
  label = "アメダス地点",
  allowGps = false,
  layout = "stack",
  onGpsMessage,
}: Props) {
  const prefectures = useMemo(
    () => prefecturesInStations(stations.map((item) => item.station_id)),
    [stations],
  );
  const [prefecture, setPrefecture] = useState(
    () => prefectureFromStationId(value) || prefectures[0] || "東京都",
  );
  const [gpsReady, setGpsReady] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const next = prefectureFromStationId(value);
    if (next) {
      setPrefecture(next);
    }
  }, [value]);

  useEffect(() => {
    setGpsReady(canUseGeolocation());
  }, []);

  const options = useMemo(() => {
    const filtered = stations.filter((item) => prefectureFromStationId(item.station_id) === prefecture);
    if (!value || filtered.some((item) => item.station_id === value)) {
      return filtered;
    }
    return [...filtered, ...stations.filter((item) => item.station_id === value)];
  }, [prefecture, stations, value]);

  function onPrefectureChange(next: string) {
    setPrefecture(next);
    const inPref = stations.filter((item) => prefectureFromStationId(item.station_id) === next);
    if (inPref.some((item) => item.station_id === value) || inPref.length === 0) {
      return;
    }
    onChange(inPref[0].station_id);
  }

  async function onFindByGps() {
    if (!gpsReady || disabled || locating) {
      return;
    }
    setLocating(true);
    try {
      const here = await requestCurrentPosition();
      const nearest = nearestStation(stations, here.latitude, here.longitude);
      if (nearest == null) {
        onGpsMessage?.("最寄りの観測所を探せませんでした", "error");
        return;
      }
      onChange(nearest.station_id);
      onGpsMessage?.(`${nearest.name}（${nearest.station_id}）を選びました`, "ok");
    } catch (error) {
      onGpsMessage?.(error instanceof Error ? error.message : "現在地を取得できませんでした", "error");
    } finally {
      setLocating(false);
    }
  }

  const prefectureSelect = (
    <select
      aria-label="都道府県"
      value={prefecture}
      disabled={disabled}
      required
      onChange={(event) => onPrefectureChange(event.target.value)}
    >
      {prefectures.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
  const stationSelect = (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      required
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((item) => (
        <option key={item.station_id} value={item.station_id}>
          {item.station_id} {item.name}
        </option>
      ))}
    </select>
  );
  const gpsButton = allowGps ? (
    <button
      type="button"
      className={layout === "run" ? "button run-station__gps" : "button"}
      disabled={disabled || !gpsReady || locating || stations.length === 0}
      title={gpsReady ? undefined : geolocationUnavailableReason()}
      onClick={() => void onFindByGps()}
    >
      {locating ? "探しています..." : "GPSで探す"}
    </button>
  ) : null;

  if (layout === "run") {
    return (
      <div className="run-station">
        <p className="run-station__title">走行地点</p>
        <div className="run-station__body">
          <div className="run-station__fields">
            <label>
              都道府県
              {prefectureSelect}
            </label>
            <label>
              {label}
              {stationSelect}
            </label>
          </div>
          {gpsButton}
        </div>
      </div>
    );
  }

  return (
    <>
      <label>
        都道府県
        {prefectureSelect}
      </label>
      <div className="station-pick-row">
        <label>
          {label}
          {stationSelect}
        </label>
        {gpsButton}
      </div>
    </>
  );
}
