/** 天気の表示名ごとの減点。快晴・晴れ・不明は引かない。 */
const WEATHER_PENALTY: Record<string, number> = {
  快晴: 0,
  晴れ: 0,
  霧: 15,
  霧雨: 25,
  にわか雨: 30,
  雨: 40,
  にわか雪: 40,
  雪: 50,
  雷雨: 60,
  "—": 0,
};

const WEATHER_MARK: Record<string, string> = {
  快晴: "☀️",
  晴れ: "🌤️",
  霧: "🌫️",
  霧雨: "🌦️",
  にわか雨: "🌦️",
  雨: "🌧️",
  にわか雪: "🌨️",
  雪: "❄️",
  雷雨: "⛈️",
  "—": "—",
};

/**
 * 適温（10以上15未満）から外れた WBGT の減点。
 * 寒すぎるは 1点/℃、快適は 2点/℃、暑い・暑すぎるはより重い。
 */
export function wbgtRunPenalty(wbgtC: number): number {
  if (!(wbgtC < 10)) {
    if (wbgtC < 15) {
      return 0;
    }
    if (wbgtC < 21) {
      return (wbgtC - 15) * 2;
    }
    if (wbgtC < 28) {
      return 12 + (wbgtC - 21) * 4;
    }
    return 40 + (wbgtC - 28) * 6;
  }
  return (10 - wbgtC) * 1;
}

export function weatherRunPenalty(weatherLabel: string): number {
  return WEATHER_PENALTY[weatherLabel] ?? 0;
}

export function weatherMark(weatherLabel: string): string {
  return WEATHER_MARK[weatherLabel] ?? "—";
}

/** 100点から減点し、0未満にはしない。表示は整数。 */
export function runnabilityScore(wbgtC: number, weatherLabel: string): number {
  const penalty = wbgtRunPenalty(wbgtC) + weatherRunPenalty(weatherLabel);
  return Math.max(0, Math.round(100 - penalty));
}

/** 点数が高いほど厳しい順で絵文字を返す。 */
export function runnabilityMark(score: number): string {
  if (score >= 90) {
    return "😄";
  }
  if (score >= 80) {
    return "🙂";
  }
  if (score >= 60) {
    return "😐";
  }
  if (score >= 30) {
    return "😣";
  }
  return "😫";
}

export function formatRunnability(wbgtC: number, weatherLabel: string): string {
  const score = runnabilityScore(wbgtC, weatherLabel);
  return `${runnabilityMark(score)} ${score}`;
}

export function formatWeatherWithMark(weatherLabel: string): string {
  const mark = weatherMark(weatherLabel);
  if (mark === "—" || weatherLabel === "—") {
    return "—";
  }
  return `${mark} ${weatherLabel}`;
}

export function formatWbgtFeel(wbgtC: number, feelLabel: string): string {
  return `${wbgtC.toFixed(1)}℃ ${feelLabel}`;
}
