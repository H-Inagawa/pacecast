/**
 * API パスと HTTP メソッドから、共有スピナー下の待ち文言を返す。
 * 該当が無いときは空文字（読み上げ用の「処理中」のみ）。
 * @param path API パス（クエリ付き可）
 * @param method HTTP メソッド
 * @returns スピナー下に出す1行。無ければ空文字
 */
export function loadingMessageFor(path: string, method = "GET"): string {
  const normalized = path.split("?")[0] ?? path;
  const verb = method.toUpperCase();

  if (normalized === "/api/auth/login" && verb === "POST") {
    return "ログインしています...";
  }
  if (normalized === "/api/auth/register" && verb === "POST") {
    return "登録中です...";
  }
  if (normalized.startsWith("/api/auth/verify") && verb === "GET") {
    return "確認中です...";
  }
  if (normalized === "/api/auth/forgot-password" && verb === "POST") {
    return "再設定メールを送信中です...";
  }
  if (normalized === "/api/auth/reset-password" && verb === "POST") {
    return "保存中です...";
  }
  if (normalized === "/api/auth/logout" && verb === "POST") {
    return "ログアウトしています...";
  }
  if (normalized === "/api/profile" && verb === "GET") {
    return "設定情報を読み込み中です...";
  }
  if (normalized === "/api/profile" && verb === "PUT") {
    return "保存中です...";
  }
  if (normalized === "/api/amedas/stations" && verb === "GET") {
    return "設定情報を読み込み中です...";
  }
  if (normalized === "/api/runs" && verb === "GET") {
    return "走行記録を取得中です...";
  }
  if (normalized === "/api/runs" && verb === "POST") {
    return "走行記録を登録中です...";
  }
  if (/^\/api\/runs\/[^/]+$/.test(normalized) && verb === "GET") {
    return "詳細取得中です...";
  }
  if (/^\/api\/runs\/[^/]+$/.test(normalized) && verb === "PUT") {
    return "走行記録を更新中です...";
  }
  if (/^\/api\/runs\/[^/]+$/.test(normalized) && verb === "DELETE") {
    return "走行記録を削除中です...";
  }
  if (normalized === "/api/predict" && verb === "POST") {
    return "予測中です...";
  }
  if (normalized === "/api/forecast" && verb === "GET") {
    return "天気情報を取得中です...";
  }
  return "";
}

/** サイト内の画面遷移中に出す文言。 */
export const NAVIGATION_LOADING_MESSAGE = "お待ちください...";

/** コース画面で現在地を取るあいだに出す文言。 */
export const COURSE_LOCATE_LOADING_MESSAGE = "現在地の情報を取得中です...";
