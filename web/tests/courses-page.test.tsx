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
  });

  it("地図の起点と距離で作成し、3案から選ぶ", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          station_name: "練馬",
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
              ascent_m: 12,
              descent_m: 11,
              prediction: {
                pace_sec_per_km: 330,
                duration_sec: 1683,
                rmse_sec_per_km: 15,
                confidence: "medium",
                sample_count: 8,
                r_squared: 0.55,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<CoursesPage />);
    await user.click(screen.getByRole("button", { name: "地図をタップ" }));
    await user.click(screen.getByRole("button", { name: "コースを作る" }));
    expect(await screen.findByText("コース 1")).toBeInTheDocument();
    expect(screen.getByText(/練馬/)).toBeInTheDocument();
    expect(screen.getByText(/信号 2回/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /コース 1/ })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          distance_km: 5,
          latitude: 35.74,
          longitude: 139.65,
          intensity: "medium",
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
