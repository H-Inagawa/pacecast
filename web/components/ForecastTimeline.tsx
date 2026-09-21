"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { HelpTip, FORECAST_WBGT_HELP_TEXT } from "./WeatherDistanceHelp";
import { ForecastChart } from "./ForecastChart";
import {
  FORECAST_COLUMN_LABELS,
  FORECAST_OPTIONAL_COLUMNS,
  type ForecastColumnVisibility,
  type OptionalForecastColumn,
} from "../lib/forecastColumns";
import {
  FORECAST_CHART_RIGHT_PX,
  FORECAST_HOUR_COL_PX,
  FORECAST_LABEL_COL_PX,
  formatForecastColumnHeader,
  forecastScrollStartIndex,
  forecastTimelineWidthPx,
} from "../lib/runningForecast";
import type { RunningForecastHour } from "../lib/types";

type Props = {
  hours: RunningForecastHour[];
  columns: ForecastColumnVisibility;
};

function cellClass(hour: RunningForecastHour): string {
  return `wbgt-${hour.weather_zone}`;
}

function formatMetric(key: OptionalForecastColumn, hour: RunningForecastHour): string {
  switch (key) {
    case "weather":
      return hour.weather_label;
    case "feel":
      return hour.feel_label;
    case "wbgt":
      return `${hour.wbgt_c.toFixed(1)}℃`;
    case "temperature":
      return `${hour.temperature_c.toFixed(1)}℃`;
    case "humidity":
      return `${hour.humidity_pct.toFixed(0)}%`;
    case "wind":
      return `${hour.wind_ms.toFixed(1)}m/s`;
    case "solar":
      return `${hour.solar_wm2.toFixed(0)}`;
  }
}

export function ForecastTimeline({ hours, columns }: Props) {
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const visibleMetrics = FORECAST_OPTIONAL_COLUMNS.filter((key) => columns[key]);
  const tableWidth = forecastTimelineWidthPx(hours.length) - FORECAST_CHART_RIGHT_PX;

  useEffect(() => {
    const startIndex = forecastScrollStartIndex(hours);
    const scrollLeft = startIndex * FORECAST_HOUR_COL_PX;
    const chart = chartScrollRef.current;
    const table = tableScrollRef.current;
    if (chart) {
      chart.scrollLeft = scrollLeft;
    }
    if (table) {
      table.scrollLeft = scrollLeft;
    }
  }, [hours]);

  function syncScroll(source: "chart" | "table") {
    if (syncingRef.current) {
      return;
    }
    const chart = chartScrollRef.current;
    const table = tableScrollRef.current;
    if (!chart || !table) {
      return;
    }
    const next = source === "chart" ? chart.scrollLeft : table.scrollLeft;
    syncingRef.current = true;
    if (source === "chart") {
      table.scrollLeft = next;
    } else {
      chart.scrollLeft = next;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  const tableStyle = {
    width: tableWidth,
    ["--forecast-label-col" as string]: `${FORECAST_LABEL_COL_PX}px`,
    ["--forecast-hour-col" as string]: `${FORECAST_HOUR_COL_PX}px`,
  } as CSSProperties;

  return (
    <div className="forecast-timeline">
      <figure className="chart-frame forecast-chart-frame">
        <figcaption>
          <span>気温・湿度は破線、WBGT は実線</span>
        </figcaption>
        <div className="forecast-axis-scroll" ref={chartScrollRef} onScroll={() => syncScroll("chart")}>
          <ForecastChart hours={hours} />
        </div>
      </figure>
      <div className="table-scroll forecast-table-scroll" ref={tableScrollRef} onScroll={() => syncScroll("table")}>
        <table className="forecast-table" style={tableStyle}>
          <thead>
            <tr>
              <th scope="col">項目</th>
              {hours.map((hour) => (
                <th key={hour.observed_at} scope="col">
                  {formatForecastColumnHeader(hour.observed_at)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMetrics.map((key) => (
              <tr key={key}>
                <th scope="row">
                  {key === "wbgt" ? (
                    <HelpTip label="WBGT" text={FORECAST_WBGT_HELP_TEXT} ariaLabel="WBGTの説明" />
                  ) : (
                    FORECAST_COLUMN_LABELS[key]
                  )}
                </th>
                {hours.map((hour) => (
                  <td key={`${key}-${hour.observed_at}`} className={cellClass(hour)}>
                    {formatMetric(key, hour)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
