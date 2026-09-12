"use client";

import { useMemo, useState } from "react";
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
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const query = filter.trim();
    const filtered = query
      ? stations.filter((item) => item.name.includes(query) || item.station_id.includes(query))
      : stations;
    if (!value || filtered.some((item) => item.station_id === value)) {
      return filtered;
    }
    return [...filtered, ...stations.filter((item) => item.station_id === value)];
  }, [filter, stations, value]);

  return (
    <>
      <label>
        地点の絞り込み
        <input
          type="search"
          placeholder="地点名や番号で絞り込み"
          value={filter}
          disabled={disabled}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      <label>
        {label}
        <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
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
