import type { CourseSearchStage } from "./courses";

type CourseSearchEvent =
  | { type: "progress"; percent: number; passed: number; stage: CourseSearchStage }
  | { type: "error"; detail: string }
  | { type: "result"; payload: Record<string, unknown> };

function parseStage(value: unknown): CourseSearchStage {
  if (value === "explore" || value === "near" || value === "features" || value === "major" || value === "map") {
    return value;
  }
  return "major";
}

function parseCourseSearchLine(line: string): CourseSearchEvent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("周回コースを作れませんでした");
  }
  if (typeof parsed !== "object" || parsed == null) {
    throw new Error("周回コースを作れませんでした");
  }
  const event = parsed as { type?: string; percent?: number; passed?: number; stage?: string; detail?: string };
  if (event.type === "progress" && typeof event.percent === "number") {
    return {
      type: "progress",
      percent: event.percent,
      passed: typeof event.passed === "number" ? event.passed : 0,
      stage: parseStage(event.stage),
    };
  }
  if (event.type === "error") {
    return {
      type: "error",
      detail: typeof event.detail === "string" ? event.detail : "周回コースを作れませんでした",
    };
  }
  if (event.type === "result") {
    const { type: _type, ...payload } = parsed as { type: string };
    return { type: "result", payload };
  }
  return null;
}

export async function readCourseSearchEvents<T>(
  stream: ReadableStream<Uint8Array>,
  onProgress: (percent: number, passed: number, stage: CourseSearchStage) => void,
): Promise<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;
  const take = (event: CourseSearchEvent): T | null => {
    if (event.type === "progress") {
      onProgress(event.percent, event.passed, event.stage);
      return null;
    }
    if (event.type === "error") {
      throw new Error(event.detail);
    }
    return event.payload as T;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseCourseSearchLine(line);
        if (event == null) {
          continue;
        }
        const found = take(event);
        if (found) {
          result = found;
          return result;
        }
      }
      if (done) {
        break;
      }
    }
    if (buffer.trim()) {
      const event = parseCourseSearchLine(buffer);
      if (event) {
        const found = take(event);
        if (found) {
          result = found;
        }
      }
    }
  } finally {
    // 結果の行のあと、接続の終了通知が来なくてもスピナーを閉じる
    void reader.cancel().catch(() => undefined);
  }
  if (result == null) {
    throw new Error("周回コースを作れませんでした");
  }
  return result;
}
