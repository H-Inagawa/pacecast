"use client";

import { useEffect, useRef } from "react";
import {
  FORECAST_COLUMN_LABELS,
  FORECAST_OPTIONAL_COLUMNS,
  type ForecastColumnVisibility,
  type OptionalForecastColumn,
} from "../lib/forecastColumns";
import { formatRunnability, formatWbgtFeel, formatWeatherWithMark, runnabilityScore } from "../lib/runnability";
import { formatForecastColumnHeader, forecastScrollStartIndex } from "../lib/runningForecast";
import { formatWindWithDirection } from "../lib/wind";
import type { RunningForecastHour } from "../lib/types";

type Props = {
  hours: RunningForecastHour[];
  columns: ForecastColumnVisibility;
};

function optionalValue(key: OptionalForecastColumn, hour: RunningForecastHour): string {
  switch (key) {
    case "temperature":
      return `${hour.temperature_c.toFixed(1)}℃`;
    case "humidity":
      return `${hour.humidity_pct.toFixed(0)}%`;
    case "wind":
      return formatWindWithDirection(hour.wind_ms, hour.wind_dir_deg);
    case "solar":
      return `${hour.solar_wm2.toFixed(0)}`;
  }
}

function EaseCell({ hour }: { hour: RunningForecastHour }) {
  const score = runnabilityScore(hour.wbgt_c, hour.weather_label);
  return (
    <td className="ease-cell" style={{ ["--ease" as string]: `${score}%` }}>
      <span>{formatRunnability(hour.wbgt_c, hour.weather_label)}</span>
    </td>
  );
}

export function ForecastNowTable({ hour }: { hour: RunningForecastHour }) {
  return (
    <div className="forecast-now-block">
      <h2 className="forecast-now-title">現在の気象</h2>
      <div className="forecast-strip-scroll">
        <table className="forecast-table forecast-now-table">
          <thead>
            <tr>
              <th scope="col">{FORECAST_COLUMN_LABELS.runnability}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.weather}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.wbgt_feel}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.temperature}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.humidity}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.wind}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.solar}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <EaseCell hour={hour} />
              <td>{formatWeatherWithMark(hour.weather_label)}</td>
              <td className={`wbgt-${hour.weather_zone}`}>{formatWbgtFeel(hour.wbgt_c, hour.feel_label)}</td>
              <td>{optionalValue("temperature", hour)}</td>
              <td>{optionalValue("humidity", hour)}</td>
              <td>{optionalValue("wind", hour)}</td>
              <td>{optionalValue("solar", hour)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ForecastTimeline({ hours, columns }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startIndex = forecastScrollStartIndex(hours);
  const visibleOptional = FORECAST_OPTIONAL_COLUMNS.filter((key) => columns[key]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const row = scroller.querySelector<HTMLTableRowElement>("[data-forecast-start='true']");
    const header = scroller.querySelector("thead");
    if (!row) {
      return;
    }
    const rowTop = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    scroller.scrollTop = Math.max(0, rowTop - headerHeight);
  }, [hours]);

  return (
    <div className="forecast-timeline">
      <h2 className="forecast-now-title">走りやすさ予報</h2>
      <div className="table-scroll forecast-table-scroll" ref={scrollRef}>
        <table className="forecast-table">
          <thead>
            <tr>
              <th scope="col">{FORECAST_COLUMN_LABELS.observed_at}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.runnability}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.weather}</th>
              <th scope="col">{FORECAST_COLUMN_LABELS.wbgt_feel}</th>
              {visibleOptional.map((key) => (
                <th key={key} scope="col">
                  {FORECAST_COLUMN_LABELS[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour, index) => (
              <tr key={hour.observed_at} data-forecast-start={index === startIndex ? "true" : undefined}>
                <th scope="row">{formatForecastColumnHeader(hour.observed_at)}</th>
                <EaseCell hour={hour} />
                <td>{formatWeatherWithMark(hour.weather_label)}</td>
                <td className={`wbgt-${hour.weather_zone}`}>{formatWbgtFeel(hour.wbgt_c, hour.feel_label)}</td>
                {visibleOptional.map((key) => (
                  <td key={key}>{optionalValue(key, hour)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
