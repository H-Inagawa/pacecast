export const FORECAST_SLOT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const;
export const FORECAST_DAYS = 3;

export function isForecastSlotHour(hour: number): boolean {
  return (FORECAST_SLOT_HOURS as readonly number[]).includes(hour);
}

/** 予報の日時文字列（YYYY-MM-DD HH:mm）をミリ秒にする */
export function parseForecastObservedAt(observedAt: string): number {
  return new Date(`${observedAt.replace(" ", "T")}+09:00`).getTime();
}

/** グラフ・表の横軸用に日付と時刻を分ける */
export function formatForecastAxisLabel(observedAt: string): { dateLabel: string; hourLabel: string } {
  const [datePart, timePart] = observedAt.split(" ");
  const [, month, day] = datePart.split("-");
  const hour = Number(timePart.slice(0, 2));
  return {
    dateLabel: `${Number(month)}/${Number(day)}`,
    hourLabel: `${hour}時`,
  };
}

/** 表ヘッダ用の短い日時 */
export function formatForecastColumnHeader(observedAt: string): string {
  const { dateLabel, hourLabel } = formatForecastAxisLabel(observedAt);
  return `${dateLabel} ${hourLabel}`;
}

/** いまに最も近い予報スロットを選ぶ */
export function pickCurrentForecastHour<T extends { observed_at: string }>(
  hours: T[],
  nowMs: number = Date.now(),
): T | null {
  if (hours.length === 0) {
    return null;
  }
  let best = hours[0];
  let bestDiff = Math.abs(parseForecastObservedAt(best.observed_at) - nowMs);
  for (const hour of hours.slice(1)) {
    const diff = Math.abs(parseForecastObservedAt(hour.observed_at) - nowMs);
    if (diff < bestDiff) {
      best = hour;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * 初期表示で上に来せる行。いま以降の最初のスロット（無ければ末尾）のインデックス。
 */
export function forecastScrollStartIndex<T extends { observed_at: string }>(
  hours: T[],
  nowMs: number = Date.now(),
): number {
  if (hours.length === 0) {
    return 0;
  }
  const index = hours.findIndex((hour) => parseForecastObservedAt(hour.observed_at) >= nowMs);
  if (index < 0) {
    return hours.length - 1;
  }
  return index;
}
