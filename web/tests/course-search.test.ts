import { describe, expect, it } from "vitest";
import { readCourseSearchEvents } from "../lib/course-search";

function streamFrom(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body as ReadableStream<Uint8Array>;
}

describe("course search stream", () => {
  it("途中の割合を渡してから結果を返す", async () => {
    const seen: number[] = [];
    const result = await readCourseSearchEvents<{ station_name: string }>(
      streamFrom(
        [
          JSON.stringify({ type: "progress", percent: 50 }),
          JSON.stringify({ type: "result", station_name: "練馬", courses: [] }),
        ].join("\n"),
      ),
      (percent) => seen.push(percent),
    );
    expect(seen).toEqual([50]);
    expect(result.station_name).toBe("練馬");
  });

  it("失敗の行は案内にして返す", async () => {
    await expect(
      readCourseSearchEvents(streamFrom(`${JSON.stringify({ type: "error", detail: "混んでいます" })}\n`), () => {}),
    ).rejects.toThrow("混んでいます");
  });
});