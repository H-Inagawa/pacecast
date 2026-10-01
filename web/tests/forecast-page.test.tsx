import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForecastPage from "../app/forecast/page";
import { profileFixture } from "./fixtures";

const apiGet = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
}));

const hours = [
  {
    observed_at: "2026-09-21 00:00",
    hour: 0,
    weather_code: 0,
    weather_label: "快晴",
    weather_zone: "comfort" as const,
    feel_label: "快適",
    wbgt_c: 18.2,
    temperature_c: 20.1,
    humidity_pct: 55,
    wind_ms: 2.2,
    wind_dir_deg: 45,
    solar_wm2: 0,
  },
  {
    observed_at: "2026-09-21 03:00",
    hour: 3,
    weather_code: 61,
    weather_label: "雨",
    weather_zone: "hot" as const,
    feel_label: "暑い",
    wbgt_c: 22.4,
    temperature_c: 24.0,
    humidity_pct: 70,
    wind_ms: 1.5,
    wind_dir_deg: 180,
    solar_wm2: 0,
  },
];

describe("ランニング天気予報", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-21T00:20:00+09:00").getTime());
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/profile") {
        return profileFixture;
      }
      if (path === "/api/amedas/stations") {
        return [{ station_id: "44071", name: "練馬", latitude: 35.7, longitude: 139.6, prefecture: "東京都" }];
      }
      if (path.startsWith("/api/forecast")) {
        return { station_id: "44071", station_name: "練馬", hours };
      }
      throw new Error(path);
    });
  });

  it("時刻を縦に、走りやすさと現在の気象を出す", async () => {
    const user = userEvent.setup();
    render(<ForecastPage />);
    expect(await screen.findByRole("columnheader", { name: "日時" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "9/21 0時" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "9/21 3時" })).toBeInTheDocument();
    expect(screen.getAllByText("😄 94").length).toBeGreaterThan(0);
    expect(screen.getByText("😣 42")).toBeInTheDocument();
    expect(screen.getAllByText("☀️ 快晴").length).toBeGreaterThan(0);
    expect(screen.getAllByText("18.2℃ 快適").length).toBeGreaterThan(0);
    expect(screen.queryByRole("img", { name: "気温・湿度・WBGTの予報グラフ" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "現在の気象" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "走りやすさ予報" })).toBeInTheDocument();
    expect(screen.getByText("走りやすい時間を確認します。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GPSで探す" })).toBeInTheDocument();
    const forecastTable = screen.getByRole("rowheader", { name: "9/21 3時" }).closest("table");
    expect(forecastTable).not.toBeNull();
    expect(within(forecastTable as HTMLElement).queryByRole("columnheader", { name: "気温" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "走りやすさとは？" }));
    const scoreDialog = screen.getByRole("dialog", { name: "走りやすさ" });
    expect(scoreDialog).toHaveTextContent("100点満点で、走りやすさを採点します。");
    expect(scoreDialog.querySelector("br")).not.toBeNull();
    expect(within(scoreDialog).getAllByRole("table")).toHaveLength(3);
    expect(within(scoreDialog).getByRole("columnheader", { name: "評価" })).toBeInTheDocument();
    expect(scoreDialog).toHaveTextContent("90点以上");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "走りやすさ" })).not.toBeInTheDocument();
  });

  it("表示項目設定で任意の列を足せる。必須列は外せない", async () => {
    const user = userEvent.setup();
    render(<ForecastPage />);
    await screen.findAllByText("☀️ 快晴");
    await user.click(screen.getByRole("button", { name: "表示項目設定" }));
    const dialog = screen.getByRole("dialog", { name: "表示項目設定" });
    expect(within(dialog).getByLabelText("天気（必須）")).toBeDisabled();
    expect(within(dialog).queryByText("追加する列を選びます", { exact: false })).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("気温"));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    const forecastTable = screen.getByRole("rowheader", { name: "9/21 0時" }).closest("table");
    expect(within(forecastTable as HTMLElement).getByRole("columnheader", { name: "天気" })).toBeInTheDocument();
    expect(within(forecastTable as HTMLElement).getByRole("columnheader", { name: "気温" })).toBeInTheDocument();
    expect(within(forecastTable as HTMLElement).getByText("20.1℃")).toBeInTheDocument();
  });
});
