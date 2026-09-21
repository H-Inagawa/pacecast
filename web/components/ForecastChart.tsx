import { paddedRange } from "../lib/analyze";
import {
  FORECAST_CHART_BOTTOM_PX,
  FORECAST_CHART_HEIGHT_PX,
  FORECAST_CHART_RIGHT_PX,
  FORECAST_CHART_TOP_PX,
  FORECAST_HOUR_COL_PX,
  FORECAST_LABEL_COL_PX,
  formatForecastAxisLabel,
  forecastTimelineWidthPx,
} from "../lib/runningForecast";
import type { RunningForecastHour } from "../lib/types";

type Props = {
  hours: RunningForecastHour[];
};

function ticks(min: number, max: number, count: number): number[] {
  if (count < 2 || min === max) {
    return [min];
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function polyline(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function ForecastChart({ hours }: Props) {
  const width = forecastTimelineWidthPx(hours.length);
  const height = FORECAST_CHART_HEIGHT_PX;
  const left = FORECAST_LABEL_COL_PX;
  const right = FORECAST_CHART_RIGHT_PX;
  const top = FORECAST_CHART_TOP_PX;
  const bottom = FORECAST_CHART_BOTTOM_PX;
  const temps = hours.map((item) => item.temperature_c);
  const wbgts = hours.map((item) => item.wbgt_c);
  const hums = hours.map((item) => item.humidity_pct);
  const [tempMin, tempMax] = paddedRange([...temps, ...wbgts], 4);
  const [humMin, humMax] = paddedRange(hums, 10);
  const innerW = Math.max(hours.length, 1) * FORECAST_HOUR_COL_PX;
  const innerH = height - top - bottom;

  function x(index: number): number {
    if (hours.length <= 1) {
      return left + FORECAST_HOUR_COL_PX / 2;
    }
    return left + index * FORECAST_HOUR_COL_PX + FORECAST_HOUR_COL_PX / 2;
  }

  function yTemp(value: number): number {
    return top + ((tempMax - value) / (tempMax - tempMin)) * innerH;
  }

  function yHum(value: number): number {
    return top + ((humMax - value) / (humMax - humMin)) * innerH;
  }

  const tempLine = hours.map((item, index) => ({ x: x(index), y: yTemp(item.temperature_c) }));
  const wbgtLine = hours.map((item, index) => ({ x: x(index), y: yTemp(item.wbgt_c) }));
  const humLine = hours.map((item, index) => ({ x: x(index), y: yHum(item.humidity_pct) }));

  return (
    <svg
      className="chart chart-timeline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="気温・湿度・WBGTの予報グラフ"
    >
      <rect x={left} y={top} width={innerW} height={innerH} className="chart-plot" />
      {ticks(tempMin, tempMax, 5).map((value) => (
        <g key={`t-${value}`}>
          <line x1={left} x2={left + innerW} y1={yTemp(value)} y2={yTemp(value)} className="chart-grid" />
          <text x={left - 8} y={yTemp(value) + 4} className="chart-tick" textAnchor="end">
            {value.toFixed(0)}
          </text>
        </g>
      ))}
      {ticks(humMin, humMax, 5).map((value) => (
        <text key={`h-${value}`} x={left + innerW + 8} y={yHum(value) + 4} className="chart-tick">
          {value.toFixed(0)}
        </text>
      ))}
      <polyline fill="none" stroke="currentColor" strokeDasharray="6 4" strokeWidth="2" points={polyline(tempLine)} className="forecast-line-temp" />
      <polyline fill="none" stroke="currentColor" strokeDasharray="6 4" strokeWidth="2" points={polyline(humLine)} className="forecast-line-hum" />
      <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={polyline(wbgtLine)} className="forecast-line-wbgt" />
      <text x={8} y={top + 12} className="chart-axis">
        ℃
      </text>
      <text x={width - 8} y={top + 12} className="chart-axis" textAnchor="end">
        %
      </text>
      {hours.map((item, index) => {
        const { dateLabel, hourLabel } = formatForecastAxisLabel(item.observed_at);
        const px = x(index);
        const py = height - 10;
        return (
          <text
            key={item.observed_at}
            x={px}
            y={py}
            className="chart-tick chart-tick-time"
            textAnchor="end"
            transform={`rotate(-45 ${px} ${py})`}
          >
            {`${dateLabel} ${hourLabel}`}
          </text>
        );
      })}
    </svg>
  );
}
