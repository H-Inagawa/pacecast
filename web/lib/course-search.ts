type CourseSearchEvent =
  | { type: "progress"; percent: number }
  | { type: "error"; detail: string }
  | { type: "result"; payload: Record<string, unknown> };

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
  const event = parsed as { type?: string; percent?: number; detail?: string };
  if (event.type === "progress" && typeof event.percent === "number") {
    return { type: "progress", percent: event.percent };
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
  onProgress: (percent: number) => void,
): Promise<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;
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
        if (event.type === "progress") {
          onProgress(event.percent);
        } else if (event.type === "error") {
          throw new Error(event.detail);
        } else {
          result = event.payload as T;
        }
      }
      if (done) {
        break;
      }
    }
    if (buffer.trim()) {
      const event = parseCourseSearchLine(buffer);
      if (event?.type === "progress") {
        onProgress(event.percent);
      } else if (event?.type === "error") {
        throw new Error(event.detail);
      } else if (event?.type === "result") {
        result = event.payload as T;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (result == null) {
    throw new Error("周回コースを作れませんでした");
  }
  return result;
}
