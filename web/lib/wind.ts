const COMPASS_8 = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"] as const;

/**
 * 風向（度、気象の「風が吹いてくる方位」）を8方位の日本語にする。
 * 引数: degrees - 0〜360（null 可）
 * 戻り値: 「北」など。取れないときは null
 */
export function windDirectionLabel(degrees: number | null | undefined): string | null {
  if (degrees == null || Number.isNaN(degrees)) {
    return null;
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_8[index];
}

/**
 * 風向付きの風速表示（例: 北東 4.8m/s）。風向が無いときは風速のみ。
 * 引数: windMs - 風速 m/s、degrees - 風向の度
 * 戻り値: 表示用文字列
 */
export function formatWindWithDirection(windMs: number, degrees: number | null | undefined): string {
  const speed = `${windMs.toFixed(1)}m/s`;
  const direction = windDirectionLabel(degrees);
  return direction ? `${direction} ${speed}` : speed;
}
