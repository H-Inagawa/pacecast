export function durationFromHms(hours: number, minutes: number, seconds: number): number {
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    throw new Error("時は 0〜23 で選択してください");
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new Error("分は 0〜59 で選択してください");
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    throw new Error("秒は 0〜59 で選択してください");
  }
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total <= 0) {
    throw new Error("走行時間は 1 秒以上にしてください");
  }
  return total;
}

export function splitDuration(seconds: number): [number, number, number] {
  const total = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const rem = total % 3600;
  const minutes = Math.floor(rem / 60);
  const secs = rem % 60;
  return [hours, minutes, secs];
}
