import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoursesPage from "../app/courses/page";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { getLoadingCount, resetLoadingForTests } from "../lib/loading";

const requestCurrentPosition = vi.hoisted(() => vi.fn());

vi.mock("../lib/geolocation", () => ({
  requestCurrentPosition,
  readGeolocationError: (error: unknown) => (error instanceof Error ? error.message : "現在地を取得できませんでした"),
}));

vi.mock("../components/CourseMap", () => {
  const React = require("react") as typeof import("react");
  return {
    CourseMap: ({
      start,
      onPick,
      onStartPlotted,
    }: {
      start: { lat: number; lon: number } | null;
      onPick: (latitude: number, longitude: number) => void;
      onStartPlotted?: () => void;
    }) => {
      React.useEffect(() => {
        if (start) {
          onStartPlotted?.();
        }
      }, [start, onStartPlotted]);
      return (
        <button type="button" onClick={() => onPick(35.74, 139.65)}>
          地図をタップ
        </button>
      );
    },
  };
});

describe("コースを作る", () => {
  it("起点が無いと作成できない", () => {
    render(<CoursesPage />);
    expect(screen.getByRole("button", { name: "コースを作る" })).toBeDisabled();
    expect(screen.getByText("コースの作成には、数分かかることがあります。")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("作成方法を開くと説明が出て、閉じると消える", async () => {
    const user = userEvent.setup();
    render(<CoursesPage />);
    await user.click(screen.getByRole("button", { name: "作成方法" }));
    expect(screen.getByRole("dialog", { name: "作成方法" })).toBeInTheDocument();
    expect(screen.getByText(/曲がりの少なさ/)).toBeInTheDocument();
    expect(screen.getByText(/5kmを超えて3km伸びるごとに1本減らし/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("地図の起点と距離で作成し、3案から選ぶ", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        [
          JSON.stringify({ type: "progress", percent: 25 }),
          JSON.stringify({
          type: "result",
          courses: [
            {
              id: "1",
              distance_km: 5.1,
              coordinates: [
                { lat: 35.74, lon: 139.65 },
                { lat: 35.75, lon: 139.66 },
              ],
              turn_count: 4,
              signal_count: 2,
              major_km: 3.2,
              easy_km: 4.2,
              minor_km: 0.4,
              uturn_count: 0,
              clockwise_deg: 350,
              overlap_ratio: 0.02,
              ascent_m: 12,
              descent_m: 11,
              junction_count: 3,
              road_gap_km: 0.45,
              score: 74.2,
              raw_score: 40.1,
              score_parts: {
                distance: 10.8,
                easy: 13.8,
                straight: 8.1,
                turns: 18,
                overlap: 26.1,
                signals: 4.2,
                clockwise: 6,
                uturn: 5,
                minor: 4,
                junctions: 3.2,
              },
              raw_score_parts: {
                distance: 5.4,
                easy: 8.2,
                straight: 4.1,
                turns: 9,
                overlap: 13,
                signals: 2.1,
                clockwise: 3,
                uturn: 2,
                minor: 1,
                junctions: 0,
              },
            },
          ],
        }),
        ].join("\n"),
        { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
      ),
    );
    render(<CoursesPage />);
    await user.click(screen.getByRole("button", { name: "地図をタップ" }));
    await user.click(screen.getByRole("button", { name: "コースを作る" }));
    expect(await screen.findByRole("button", { name: "コース 1" })).toBeInTheDocument();
    expect(screen.queryByText(/予想ペース/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "中" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "評価詳細" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "評価内容比較" })).not.toBeInTheDocument();
    const courseButton = screen.getByRole("button", { name: "コース 1" });
    expect(courseButton).toHaveAttribute("aria-pressed", "true");
    await user.click(courseButton);
    expect(courseButton).toHaveAttribute("aria-pressed", "true");
    const rows = screen.getAllByRole("row").map((row) => row.textContent ?? "");
    expect(rows[1]).toMatch(/距離/);
    expect(rows[1]).toMatch(/5\.10km/);
    expect(rows[2]).toMatch(/付近の道まで/);
    expect(rows[2]).toMatch(/0\.45km/);
    expect(rows[3]).toBe("評価74.2");
    expect(rows[4]).toBe("実スコア40.1");
    expect(screen.queryByRole("row", { name: /信号/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /走りやすい道 4\.20km \(8\.2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /上り 12m/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /設定距離からの差 \+0\.10km \(5\.4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /時計回り 350度 \(3\.0\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "採点基準" }));
    expect(screen.getByRole("dialog", { name: "採点基準" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("道路重複 10点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("全距離の10%で0点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("設定距離からの差 20点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("曲がり角 10点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("1kmあたり1か所以下");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("走りやすい道 30点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("公園内の道");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("直進 10点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("時計回り 5点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("Uターン 5点");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("配点の合計は100点です");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("信号は点数に入れません");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("付近の道までの距離も表に出しますが、点数には入れません");
    expect(screen.getByRole("dialog", { name: "採点基準" })).not.toHaveTextContent("1kmあたり5基");
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("3回で0点");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "採点基準" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          distance_km: 5,
          latitude: 35.74,
          longitude: 139.65,
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it("合格が無いときは案内と近いコースを出す", async () => {
    const user = userEvent.setup();
    const course = {
      distance_km: 6.4,
      coordinates: [
        { lat: 35.74, lon: 139.65 },
        { lat: 35.75, lon: 139.66 },
      ],
      turn_count: 4,
      signal_count: 2,
      major_km: 3.2,
      easy_km: 4.2,
      minor_km: 0.4,
      uturn_count: 0,
      clockwise_deg: 350,
      overlap_ratio: 0.2,
      ascent_m: 12,
      descent_m: 11,
      junction_count: 3,
      road_gap_km: null,
      score: 40,
      raw_score: 20,
      score_parts: {
        distance: 2,
        easy: 8,
        straight: 4,
        turns: 6,
        overlap: 0,
        signals: 2,
        clockwise: 3,
        uturn: 2,
        minor: 1,
        junctions: 0,
      },
      raw_score_parts: {
        distance: 1,
        easy: 4,
        straight: 2,
        turns: 3,
        overlap: 0,
        signals: 1,
        clockwise: 1.5,
        uturn: 1,
        minor: 0.5,
        junctions: 0,
      },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "result",
          notice: "希望の距離のコースが作れませんでした。\n指定条件に近かったコースを表示します。",
          courses: [
            { ...course, id: "1" },
            { ...course, id: "2", distance_km: 5.1, overlap_ratio: 0.24 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
      ),
    );
    render(<CoursesPage />);
    await user.click(screen.getByRole("button", { name: "地図をタップ" }));
    await user.click(screen.getByRole("button", { name: "コースを作る" }));
    expect(await screen.findByText(/希望の距離のコースが作れませんでした/)).toBeInTheDocument();
    expect(screen.getByText(/指定条件に近かったコースを表示します/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コース 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コース 2" })).toBeInTheDocument();
    fetchMock.mockRestore();
  });

  it("検索を中止するとスピナーが消え、もう一度操作できる", async () => {
    resetLoadingForTests();
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      const request = init as RequestInit | undefined;
      return new Promise((_resolve, reject) => {
        request?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    render(
      <>
        <CoursesPage />
        <LoadingOverlay />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "地図をタップ" }));
    await user.click(screen.getByRole("button", { name: "コースを作る" }));
    await user.click(await screen.findByRole("button", { name: "検索を中止" }));
    expect(await screen.findByText("検索を中止しました")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コースを作る" })).toBeEnabled();
    fetchMock.mockRestore();
  });

  it("現在地の取得中はスピナー用の待ちを出し、プロット後に閉じる", async () => {
    resetLoadingForTests();
    const user = userEvent.setup();
    let resolveHere: (position: { latitude: number; longitude: number }) => void = () => {};
    requestCurrentPosition.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHere = resolve;
        }),
    );
    render(<CoursesPage />);
    await user.click(screen.getByRole("button", { name: "現在地を使う" }));
    expect(getLoadingCount()).toBe(1);
    resolveHere({ latitude: 35.7, longitude: 139.7 });
    expect(await screen.findByText("現在地を起点にしました")).toBeInTheDocument();
    expect(getLoadingCount()).toBe(0);
  });
});
