import { paddedRange } from "../lib/analyze";
import { formatPace } from "../lib/format";
import type { RelationChart as RelationChartData } from "../lib/types";

type Props = {
  chart: RelationChartData;
};

const WIDTH = 720;
const HEIGHT = 340;
const LEFT = 72;
const RIGHT = 20;
const BOTTOM = 56;

function starPoints(cx: number, cy: number, outer = 9, inner = 4): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

function ticks(min: number, max: number, count: number): number[] {
  if (count < 2 || min === max) {
    return [min];
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function formatX(key: string, value: number): string {
  if (key === "heart_rate") {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}

export function RelationChart({ chart }: Props) {
  const top = chart.formula ? 36 : 16;
  const marker = chart.marker;
  const xs = [...chart.observed, ...chart.curve, ...(marker ? [marker] : [])].map((point) => point.x);
  const ys = [...chart.observed, ...chart.curve, ...(marker ? [marker] : [])].map((point) => point.pace_sec_per_km);
  const [xMin, xMax] = paddedRange(xs, 4);
  const [yMin, yMax] = paddedRange(ys, 60);
  const innerW = WIDTH - LEFT - RIGHT;
  const innerH = HEIGHT - top - BOTTOM;

  function x(value: number): number {
    return LEFT + ((value - xMin) / (xMax - xMin || 1)) * innerW;
  }

  function y(value: number): number {
    return top + ((yMax - value) / (yMax - yMin || 1)) * innerH;
  }

  const line = chart.curve.map((point) => `${x(point.x)},${y(point.pace_sec_per_km)}`).join(" ");

  return (
    <figure className="chart-frame">
      <figcaption>
        <strong>{chart.title}</strong>
        <span className="meta">{chart.note}</span>
      </figcaption>
      <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={chart.title}>
        {chart.formula ? (
          <text x={LEFT} y={22} className="chart-formula">
            {chart.formula}
          </text>
        ) : null}
        <rect x={LEFT} y={top} width={innerW} height={innerH} className="chart-plot" />
        {ticks(xMin, xMax, 5).map((value) => (
          <g key={`x-${value}`}>
            <line x1={x(value)} y1={top} x2={x(value)} y2={top + innerH} className="chart-grid" />
            <text x={x(value)} y={HEIGHT - 28} className="chart-tick" textAnchor="middle">
              {formatX(chart.key, value)}
            </text>
          </g>
        ))}
        {ticks(yMin, yMax, 5).map((value) => (
          <g key={`y-${value}`}>
            <line x1={LEFT} y1={y(value)} x2={LEFT + innerW} y2={y(value)} className="chart-grid" />
            <text x={LEFT - 10} y={y(value) + 4} className="chart-tick" textAnchor="end">
              {formatPace(value)}
            </text>
          </g>
        ))}
        {line ? <polyline className="chart-line" fill="none" points={line} /> : null}
        {chart.observed.map((point, index) => (
          <circle key={`${point.x}-${index}`} cx={x(point.x)} cy={y(point.pace_sec_per_km)} r={4} className="chart-dot">
            <title>
              {formatX(chart.key, point.x)} / {formatPace(point.pace_sec_per_km)}
            </title>
          </circle>
        ))}
        {marker ? (
          <polygon className="chart-star" points={starPoints(x(marker.x), y(marker.pace_sec_per_km))}>
            <title>
              予測 {formatX(chart.key, marker.x)} / {formatPace(marker.pace_sec_per_km)}
            </title>
          </polygon>
        ) : null}
        <text x={LEFT + innerW / 2} y={HEIGHT - 8} className="chart-axis" textAnchor="middle">
          {chart.x_label}
        </text>
        <text className="chart-axis" textAnchor="middle" transform={`translate(16 ${top + innerH / 2}) rotate(-90)`}>
          走行ペース
        </text>
      </svg>
    </figure>
  );
}
