import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PredictPage from "../app/predict/page";
import { predictResultFixture, profileFixture, stationsFixture } from "./fixtures";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedGet = vi.mocked(apiGet);
const mockedSend = vi.mocked(apiSend);

async function saveDistance(user: ReturnType<typeof userEvent.setup>, mode: "距離を指定" | "レース種別で予測") {
  const card = screen.getByRole("region", { name: "距離/レースを指定" });
  await user.click(within(card).getByRole("button", { name: "設定する" }));
  const dialog = screen.getByRole("dialog", { name: "距離/レースを指定" });
  await user.click(within(dialog).getByLabelText(mode));
  await user.click(within(dialog).getByRole("button", { name: "設定する" }));
}

async function saveManualWeather(user: ReturnType<typeof userEvent.setup>) {
  const card = screen.getByRole("region", { name: "気象の指定" });
  await user.click(within(card).getByRole("button", { name: "設定する" }));
  const dialog = screen.getByRole("dialog", { name: "気象の指定" });
  await user.click(within(dialog).getByLabelText("数値を入れる"));
  await user.click(within(dialog).getByRole("button", { name: "設定する" }));
}

describe("予測フォーム", () => {
  beforeEach(() => {
    mockedGet.mockImplementation(async (path: string) => {
      if (path === "/api/profile") {
        return profileFixture;
      }
      if (path === "/api/amedas/stations") {
        return stationsFixture;
      }
      throw new Error(`unexpected ${path}`);
    });
    mockedSend.mockResolvedValue(predictResultFixture);
  });

  it("未設定のあいだは予測できず、カードは設定してくださいと出す", async () => {
    render(<PredictPage />);
    expect(await screen.findByRole("button", { name: "予測する" })).toBeDisabled();
    expect(screen.getAllByText("設定してください")).toHaveLength(2);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("距離を選ぶと走行強度が出て、レースでは出ない", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByRole("button", { name: "予測する" });

    await user.click(within(screen.getByRole("region", { name: "距離/レースを指定" })).getByRole("button", { name: "設定する" }));
    const dialog = screen.getByRole("dialog", { name: "距離/レースを指定" });
    expect(within(dialog).getByLabelText("距離（km）")).toBeEnabled();
    expect(within(dialog).getByLabelText("中")).toBeEnabled();
    expect(within(dialog).getByLabelText("レース")).toBeDisabled();

    await user.click(within(dialog).getByLabelText("レース種別で予測"));
    expect(within(dialog).queryByLabelText("中")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("距離（km）")).toBeDisabled();
    expect(within(dialog).getByLabelText("レース")).toBeEnabled();
  });

  it("予報を選ぶと気温と湿度は disabled のまま残る", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByRole("button", { name: "予測する" });
    await user.click(within(screen.getByRole("region", { name: "気象の指定" })).getByRole("button", { name: "設定する" }));
    const dialog = screen.getByRole("dialog", { name: "気象の指定" });

    expect(within(dialog).getByLabelText("気温")).toBeEnabled();
    await user.click(within(dialog).getByLabelText("予報から選ぶ"));
    expect(within(dialog).getByLabelText("気温")).toBeDisabled();
    expect(within(dialog).getByLabelText("湿度")).toBeDisabled();
    expect(within(dialog).getByLabelText("アメダス")).toBeEnabled();
    expect(within(dialog).getByLabelText("予報の日時")).toBeEnabled();
  });

  it("距離と手動気象を設定して予測できる", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByRole("button", { name: "予測する" });

    await saveDistance(user, "距離を指定");
    expect(screen.getByText("10.00 km / 走行強度: 中")).toBeInTheDocument();
    await saveManualWeather(user);
    expect(screen.getByText("気温 24.0℃ / 湿度 65%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "予測する" }));
    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalledWith(
        "/api/predict",
        "POST",
        expect.objectContaining({
          distance_mode: "custom",
          distance_km: 10,
          mode: "manual",
          temperature_c: 24,
          humidity_pct: 65,
          intensity: "medium",
        }),
      );
    });
    expect(screen.getByText("5'29\"/km")).toBeInTheDocument();
    expect(screen.getByText("27:24")).toBeInTheDocument();
    expect(screen.getByText(/誤差\(RMSE\) 12秒\/km/)).toBeInTheDocument();
    expect(screen.getByText(/関係の強さ\(R²\): 0.72/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "WBGT とペース" })).toBeInTheDocument();
  });

  it("予報で予測すると気象カードに現在の気象を出す", async () => {
    mockedSend.mockResolvedValue({
      ...predictResultFixture,
      condition: {
        observed_at: "2026-09-23 06:00",
        temperature_c: 22,
        humidity_pct: 74,
        location_label: "練馬",
        wind_ms: 1.4,
        wind_dir_deg: 0,
        solar_wm2: 0,
        weather_code: 1,
        wbgt_c: 18.4,
      },
    });
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByRole("button", { name: "予測する" });
    await saveDistance(user, "レース種別で予測");
    const weatherCard = screen.getByRole("region", { name: "気象の指定" });
    await user.click(within(weatherCard).getByRole("button", { name: "設定する" }));
    const dialog = screen.getByRole("dialog", { name: "気象の指定" });
    await user.click(within(dialog).getByLabelText("予報から選ぶ"));
    await user.click(within(dialog).getByRole("button", { name: "設定する" }));
    await user.click(screen.getByRole("button", { name: "予測する" }));

    expect(await screen.findByText(/天気: 晴れ/)).toBeInTheDocument();
    expect(screen.getByText(/体感: 快適/)).toBeInTheDocument();
    expect(screen.getByText(/WBGT: 18.4℃/)).toBeInTheDocument();
    expect(screen.getByText(/風速: 北 1.4m\/s/)).toBeInTheDocument();
    expect(screen.getByText("10km")).toBeInTheDocument();
  });

  it("タイトル横から予測の見方を開ける", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await user.click(await screen.findByRole("button", { name: "予測の見方" }));
    expect(screen.getByRole("dialog", { name: "予測の見方" })).toBeInTheDocument();
    expect(screen.getByText("RMSE", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "予測の見方" })).not.toBeInTheDocument();
  });
});
