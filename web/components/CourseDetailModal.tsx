import { SCORE_PART_MAX } from "../lib/courses";

export type CourseScoreParts = {
  distance: number;
  easy: number;
  straight: number;
  turns: number;
  overlap: number;
  signals: number;
  clockwise: number;
  uturn: number;
  minor: number;
  junctions: number;
};

export type CourseDetail = {
  id: string;
  distance_km: number;
  turn_count: number;
  signal_count: number;
  major_km: number;
  easy_km: number;
  minor_km: number;
  uturn_count: number;
  clockwise_deg: number;
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
  max?: number;
};

export function formatScorePoint(value: number): string {
  return value.toFixed(1);
}

export function courseScoreRows(course: CourseDetail, targetKm: number): CourseScoreRow[] {
  const scored = (
    score: number,
    raw: number,
    max: number,
  ): Pick<CourseScoreRow, "score" | "raw" | "max"> => ({
    score: formatScorePoint(score),
    raw: formatScorePoint(raw),
    max,
  });
  const blank = { score: "—", raw: "—" };
  const easyPct = course.distance_km > 0 ? Math.round((course.easy_km / course.distance_km) * 100) : 0;
  const minorPct = course.distance_km > 0 ? Math.round((course.minor_km / course.distance_km) * 100) : 0;
  return [
    {
      label: "指定との誤差",
      data: formatDistanceDelta(course.distance_km, targetKm),
      ...scored(course.score_parts.distance, course.raw_score_parts.distance, SCORE_PART_MAX.distance),
    },
    {
      label: "走りやすい道",
      data: `${easyPct}%`,
      ...scored(course.score_parts.easy, course.raw_score_parts.easy, SCORE_PART_MAX.easy),
    },
    {
      label: "細い道",
      data: `${minorPct}%`,
      ...scored(course.score_parts.minor, course.raw_score_parts.minor, SCORE_PART_MAX.minor),
    },
    {
      label: "直進",
      data: "—",
      ...scored(course.score_parts.straight, course.raw_score_parts.straight, SCORE_PART_MAX.straight),
    },
    {
      label: "信号",
      data: `${course.signal_count}回`,
      ...scored(course.score_parts.signals, course.raw_score_parts.signals, SCORE_PART_MAX.signals),
    },
    {
      label: "曲がり角",
      data: `${course.turn_count}回`,
      ...scored(course.score_parts.turns, course.raw_score_parts.turns, SCORE_PART_MAX.turns),
    },
    {
      label: "道路重複",
      data: `${Math.round(course.overlap_ratio * 100)}%`,
      ...scored(course.score_parts.overlap, course.raw_score_parts.overlap, SCORE_PART_MAX.overlap),
    },
    { label: "上り", data: `${course.ascent_m}m`, ...blank },
    { label: "下り", data: `${course.descent_m}m`, ...blank },
  ];
}

/** 項目セル。実測と「取得点 / 満点」を並べる。 */
export function courseScoreCell(row: CourseScoreRow): string {
  if (row.raw === "—" || row.max == null || row.max <= 0) {
    return row.data;
  }
  return `${row.data} (${row.raw} / ${row.max}点)`;
}

function formatDistanceDelta(actualKm: number, targetKm: number): string {
  const delta = actualKm - targetKm;
  const sign = delta > 0.005 ? "+" : delta < -0.005 ? "-" : "";
  const pct = targetKm > 0 ? Math.round((Math.abs(delta) / targetKm) * 100) : 0;
  return `${sign}${pct}%`;
}
