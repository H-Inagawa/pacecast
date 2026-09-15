import { NextResponse } from "next/server";
import { ForecastError } from "./forecast";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }
  if (error instanceof ForecastError) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.name === "AmedasError") {
    return NextResponse.json({ detail: error.message }, { status: 502 });
  }
  if (error instanceof Error && error.message) {
    const known = [
      "日時の形式が正しくありません",
      "走行時間",
      "時は",
      "分は",
      "秒は",
    ];
    if (known.some((prefix) => error.message.startsWith(prefix) || error.message.includes(prefix))) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
  }
  console.error(error);
  return NextResponse.json({ detail: "サーバーエラーが発生しました" }, { status: 500 });
}
