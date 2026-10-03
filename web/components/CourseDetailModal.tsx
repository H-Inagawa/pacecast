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
  const easyPct = course.distance_km > 0 ? Math.round((course.easy_km / course.distance_km) * 100) : 0;
  const minorPct = course.distance_km > 0 ? Math.round((course.minor_km / course.distance_km) * 100) : 0;
  return [
    {
      label: "設定距離からの差",
      data: formatDistanceDelta(course.distance_km, targetKm),
      ...scored(course.score_parts.distance, course.raw_score_parts.distance),
    },
    { label: "走りやすい道", data: `${easyPct}%`, ...scored(course.score_parts.easy, course.raw_score_parts.easy) },
    { label: "細い道", data: `${minorPct}%`, ...scored(course.score_parts.minor, course.raw_score_parts.minor) },
    { label: "直進", data: "—", ...scored(course.score_parts.straight, course.raw_score_parts.straight) },
    { label: "信号", data: `${course.signal_count}回`, ...scored(course.score_parts.signals, course.raw_score_parts.signals) },
    { label: "曲がり角", data: `${course.turn_count}回`, ...scored(course.score_parts.turns, course.raw_score_parts.turns) },
    { label: "道路重複", data: `${Math.round(course.overlap_ratio * 100)}%`, ...scored(course.score_parts.overlap, course.raw_score_parts.overlap) },
    { label: "上り", data: `${course.ascent_m}m`, ...blank },
    { label: "下り", data: `${course.descent_m}m`, ...blank },
  ];
}

export function courseScoreCell(row: CourseScoreRow): string {
  return `${row.data} (${row.raw})`;
}

function formatDistanceDelta(actualKm: number, targetKm: number): string {
  const delta = actualKm - targetKm;
  const sign = delta > 0.005 ? "+" : delta < -0.005 ? "-" : "";
  const pct = targetKm > 0 ? Math.round((Math.abs(delta) / targetKm) * 100) : 0;
  return `${sign}${Math.abs(delta).toFixed(2)}km (${sign}${pct}%)`;
}
