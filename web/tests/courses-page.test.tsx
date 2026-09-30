import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoursesPage from "../app/courses/page";
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
    expect(screen.getByText(/同じ道の往復/)).toBeInTheDocument();
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
              overlap_ratio: 0.02,
              ascent_m: 12,
              descent_m: 11,
              junction_count: 3,
              score: 74.2,
              score_parts: {
                distance: 10.8,
                major: 13.8,
                straight: 8.1,
                turns: 18,
                overlap: 26.1,
                signals: 4.2,
                junctions: 3.2,
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
    expect(screen.getByText(/実距離 5.10km/)).toBeInTheDocument();
    expect(screen.getByText(/評価 74.2点/)).toBeInTheDocument();
    expect(screen.queryByText(/予想ペース/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "中" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コース 1" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "評価詳細" }));
    expect(screen.getByRole("dialog", { name: "コース 1 の評価詳細" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /信号 2回 4.2/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /大通り 3.20km 13.8/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /上り 12m/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "採点基準" }));
    expect(screen.getByRole("dialog", { name: "採点基準" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "採点基準" })).toHaveTextContent("道路重複 28点");
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
