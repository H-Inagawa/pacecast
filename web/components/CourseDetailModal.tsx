import { formatDistanceKm } from "../lib/format";

export type CourseScoreParts = {
  distance: number;
  major: number;
  straight: number;
  turns: number;
  overlap: number;
  signals: number;
  junctions: number;
};

export type CourseDetail = {
  id: string;
  distance_km: number;
  turn_count: number;
  signal_count: number;
  major_km: number;
  overlap_ratio: number;
  ascent_m: number;
  descent_m: number;
  junction_count: number;
  score: number;
  raw_score: number;
  score_parts: CourseScoreParts;
  raw_score_parts: CourseScoreParts;
};

export type CourseScoreRow = {
  label: string;
  data: string;
  score: string;
  raw: string;
};

export function formatScorePoint(value: number): string {
  return value.toFixed(1);
}

export function courseScoreRows(course: CourseDetail, targetKm: number): CourseScoreRow[] {
  const scored = (score: number, raw: number): Pick<CourseScoreRow, "score" | "raw"> => ({
    score: formatScorePoint(score),
    raw: formatScorePoint(raw),
  });
  const blank = { score: "—", raw: "—" };
  return [
    { label: "信号", data: `${course.signal_count}回`, ...scored(course.score_parts.signals, course.raw_score_parts.signals) },
    { label: "曲がり角", data: `${course.turn_count}回`, ...scored(course.score_parts.turns, course.raw_score_parts.turns) },
    { label: "大通り", data: formatDistanceKm(course.major_km), ...blank },
    { label: "道路重複", data: `${Math.round(course.overlap_ratio * 100)}%`, ...scored(course.score_parts.overlap, course.raw_score_parts.overlap) },
    { label: "上り", data: `${course.ascent_m}m`, ...blank },
    { label: "下り", data: `${course.descent_m}m`, ...blank },
    {
      label: "設定距離からの距離",
      data: formatDistanceDelta(course.distance_km, targetKm),
      ...scored(course.score_parts.distance, course.raw_score_parts.distance),
    },
    { label: "直進", data: "—", ...scored(course.score_parts.straight, course.raw_score_parts.straight) },
    { label: "交差点", data: `${course.junction_count}回`, ...blank },
  ];
}

export function courseScoreCell(row: CourseScoreRow): string {
  return `${row.data} (${row.raw})`;
}

function formatDistanceDelta(actualKm: number, targetKm: number): string {
  const delta = actualKm - targetKm;
  const sign = delta > 0.005 ? "+" : delta < -0.005 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(2)}km`;
}
