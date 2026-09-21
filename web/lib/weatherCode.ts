export function weatherCodeLabel(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) {
    return "—";
  }
  if (code === 0) {
    return "快晴";
  }
  if (code <= 3) {
    return "晴れ";
  }
  if (code <= 48) {
    return "霧";
  }
  if (code <= 57) {
    return "霧雨";
  }
  if (code <= 67) {
    return "雨";
  }
  if (code <= 77) {
    return "雪";
  }
  if (code <= 82) {
    return "にわか雨";
  }
  if (code <= 86) {
    return "にわか雪";
  }
  return "雷雨";
}
