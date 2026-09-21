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

  it("設定地点の予報を表とグラフで出す", async () => {
    render(<ForecastPage />);
    expect(await screen.findByRole("img", { name: "気温・湿度・WBGTの予報グラフ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "9/21 0時" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "9/21 3時" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "天気" })).toBeInTheDocument();
    expect(screen.getByText("快晴")).toBeInTheDocument();
    expect(screen.getByText("快適")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "現在の気象" })).toBeInTheDocument();
    expect(screen.getByText("天気: 快晴")).toBeInTheDocument();
    expect(screen.getByText("体感: 快適")).toBeInTheDocument();
    expect(screen.getByText("WBGT: 18.2℃")).toBeInTheDocument();
    expect(screen.getByText("風速: 北東 2.2m/s")).toBeInTheDocument();
    expect(screen.getByText("北東 2.2m/s")).toBeInTheDocument();
    expect(screen.queryByText(/時点/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WBGTの説明" })).toBeInTheDocument();
  });

  it("表示項目設定で行を外せる", async () => {
    const user = userEvent.setup();
    render(<ForecastPage />);
    await screen.findByText("快晴");
    await user.click(screen.getByRole("button", { name: "表示項目設定" }));
    const dialog = screen.getByRole("dialog", { name: "表示項目設定" });
    await user.click(within(dialog).getByLabelText("天気"));
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("rowheader", { name: "天気" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "9/21 0時" })).toBeInTheDocument();
  });
});
