"use client";

import { useEffect, useMemo, useState } from "react";
import { prefectureFromStationId, prefecturesInStations } from "../lib/amedas-prefecture";
import type { AmedasStation } from "../lib/types";

type Props = {
  stations: AmedasStation[];
  value: string;
  onChange: (stationId: string) => void;
  disabled?: boolean;
  label?: string;
};

export function StationPicker({
  stations,
  value,
  onChange,
  disabled = false,
  label = "アメダス地点",
}: Props) {
  const prefectures = useMemo(
    () => prefecturesInStations(stations.map((item) => item.station_id)),
    [stations],
  );
  const [prefecture, setPrefecture] = useState(
    () => prefectureFromStationId(value) || prefectures[0] || "東京都",
  );

  useEffect(() => {
    const next = prefectureFromStationId(value);
    if (next) {
      setPrefecture(next);
    }
  }, [value]);

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

  return (
    <>
      <label>
        都道府県
        <select
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
      </label>
      <label>
        {label}
        <select value={value} disabled={disabled} required onChange={(event) => onChange(event.target.value)}>
          {options.map((item) => (
            <option key={item.station_id} value={item.station_id}>
              {item.station_id} {item.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
