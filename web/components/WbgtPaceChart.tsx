import { formatPace } from "../lib/format";
import { paddedRange, type WbgtPacePoint } from "../lib/analyze";

type Props = {
  points: WbgtPacePoint[];
};

const WIDTH = 720;
const HEIGHT = 420;
const LEFT = 72;
const RIGHT = 20;
const TOP = 16;
const BOTTOM = 56;

function ticks(min: number, max: number, count: number): number[] {
  if (count < 2 || min === max) {
    return [min];
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

export function WbgtPaceChart({ points }: Props) {
  const [xMin, xMax] = paddedRange(points.map((item) => item.wbgtC), 4);
  const [yMin, yMax] = paddedRange(points.map((item) => item.paceSecPerKm), 60);
  const innerW = WIDTH - LEFT - RIGHT;
  const innerH = HEIGHT - TOP - BOTTOM;

  function x(value: number): number {
    return LEFT + ((value - xMin) / (xMax - xMin)) * innerW;
  }

  function y(value: number): number {
    return TOP + ((yMax - value) / (yMax - yMin)) * innerH;
  }

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="推定 WBGT と走行ペースの散布図">
      <rect x={LEFT} y={TOP} width={innerW} height={innerH} className="chart-plot" />
      {ticks(xMin, xMax, 5).map((value) => (
        <g key={`x-${value}`}>
          <line x1={x(value)} y1={TOP} x2={x(value)} y2={TOP + innerH} className="chart-grid" />
          <text x={x(value)} y={HEIGHT - 28} className="chart-tick" textAnchor="middle">
            {value.toFixed(1)}
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
      {points.map((point) => (
        <circle
          key={point.runId}
          cx={x(point.wbgtC)}
          cy={y(point.paceSecPerKm)}
          r={5}
          className="chart-dot"
        >
          <title>
            {point.startedAt} / WBGT {point.wbgtC.toFixed(1)}℃ / {formatPace(point.paceSecPerKm)}
          </title>
        </circle>
      ))}
      <text x={LEFT + innerW / 2} y={HEIGHT - 8} className="chart-axis" textAnchor="middle">
        推定 WBGT（℃）
      </text>
      <text
        className="chart-axis"
        textAnchor="middle"
        transform={`translate(16 ${TOP + innerH / 2}) rotate(-90)`}
      >
        走行ペース
      </text>
    </svg>
  );
}
