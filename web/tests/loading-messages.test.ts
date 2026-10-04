import { describe, expect, it } from "vitest";
import {
  COURSE_LOCATE_LOADING_MESSAGE,
  loadingMessageFor,
  NAVIGATION_LOADING_MESSAGE,
} from "../lib/loading-messages";

describe("loading messages", () => {
  it("操作ごとの文言を返す", () => {
    expect(loadingMessageFor("/api/auth/login", "POST")).toBe("ログインしています...");
    expect(loadingMessageFor("/api/auth/register", "POST")).toBe("登録中です...");
    expect(loadingMessageFor("/api/auth/verify?token=a", "GET")).toBe("確認中です...");
    expect(loadingMessageFor("/api/auth/forgot-password", "POST")).toBe("再設定メールを送信中です...");
    expect(loadingMessageFor("/api/auth/reset-password", "POST")).toBe("保存中です...");
    expect(loadingMessageFor("/api/auth/logout", "POST")).toBe("ログアウトしています...");
    expect(loadingMessageFor("/api/profile", "GET")).toBe("設定情報を読み込み中です...");
    expect(loadingMessageFor("/api/profile", "PUT")).toBe("保存中です...");
    expect(loadingMessageFor("/api/runs", "GET")).toBe("走行記録を取得中です...");
    expect(loadingMessageFor("/api/runs", "POST")).toBe("走行記録を登録中です...");
    expect(loadingMessageFor("/api/runs/12", "GET")).toBe("詳細取得中です...");
    expect(loadingMessageFor("/api/runs/12", "PUT")).toBe("走行記録を更新中です...");
    expect(loadingMessageFor("/api/runs/12", "DELETE")).toBe("走行記録を削除中です...");
    expect(loadingMessageFor("/api/predict", "POST")).toBe("予測中です...");
    expect(loadingMessageFor("/api/forecast?station_id=44071", "GET")).toBe("天気情報を取得中です...");
    expect(NAVIGATION_LOADING_MESSAGE).toBe("お待ちください...");
    expect(COURSE_LOCATE_LOADING_MESSAGE).toBe("現在地の情報を取得中です...");
  });

  it("未定義の操作は空文字", () => {
    expect(loadingMessageFor("/api/auth/me", "GET")).toBe("");
  });
});
