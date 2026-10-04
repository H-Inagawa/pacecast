import { describe, expect, it } from "vitest";
import { readCourseSearchEvents } from "../lib/course-search";

function streamFrom(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body as ReadableStream<Uint8Array>;
}

describe("course search stream", () => {
  it("途中の段階を渡してから結果を返す", async () => {
    const seen: string[] = [];
    const result = await readCourseSearchEvents<{ station_name: string }>(
      streamFrom(
        [
          JSON.stringify({ type: "progress", percent: 0, passed: 0, stage: "map" }),
          JSON.stringify({ type: "progress", percent: 50, passed: 3, stage: "explore" }),
          JSON.stringify({ type: "result", station_name: "練馬", courses: [] }),
        ].join("\n"),
      ),
      (percent, passed, stage) => seen.push(`${stage}:${percent}:${passed}`),
    );
    expect(seen).toEqual(["map:0:0", "explore:50:3"]);
    expect(result.station_name).toBe("練馬");
  });

  it("結果の行が届いたら、接続が閉じなくても返す", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              JSON.stringify({ type: "progress", percent: 100, passed: 26, stage: "explore" }),
              JSON.stringify({ type: "result", courses: [] }),
            ].join("\n") + "\n",
          ),
        );
      },
    });
    await expect(readCourseSearchEvents<{ courses: unknown[] }>(stream, () => {})).resolves.toEqual({
      courses: [],
    });
  });

  it("失敗の行は案内にして返す", async () => {
    await expect(
      readCourseSearchEvents(streamFrom(`${JSON.stringify({ type: "error", detail: "混んでいます" })}\n`), () => {}),
    ).rejects.toThrow("混んでいます");
  });

  it("stage が無い進捗は map として扱う", async () => {
    const seen: string[] = [];
    await readCourseSearchEvents(
      streamFrom(
        [
          JSON.stringify({ type: "progress", percent: 10, passed: 1 }),
          JSON.stringify({ type: "result", courses: [] }),
        ].join("\n"),
      ),
      (_percent, _passed, stage) => seen.push(stage),
    );
    expect(seen).toEqual(["map"]);
  });
});
