import { render, screen, waitFor } from "@testing-library/react";
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

  it("選んでいない方式の入力は disabled のまま残る", async () => {
    render(<PredictPage />);

    expect(await screen.findByLabelText("距離（km）")).toBeDisabled();
    expect(screen.getByLabelText("走行強度")).toBeDisabled();
    expect(screen.getByLabelText("5km")).toBeDisabled();
    expect(screen.getByLabelText("気温（℃）")).toBeDisabled();
    expect(screen.getByLabelText("湿度（％）")).toBeDisabled();
    expect(screen.getByLabelText("予報の地点")).toBeDisabled();
    expect(screen.getByLabelText("予報を使う日時")).toBeDisabled();
  });

  it("距離と予報を選ぶと、その入力だけ使える", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByLabelText("距離（km）");

    await user.click(screen.getByLabelText("距離を指定して予測"));
    expect(screen.getByLabelText("距離（km）")).toBeEnabled();
    expect(screen.getByLabelText("5km")).toBeDisabled();

    await user.click(screen.getByLabelText("日時を指定して予報を使う"));
    expect(screen.getByLabelText("予報の地点")).toBeEnabled();
    expect(screen.getByLabelText("予報の地点")).toHaveDisplayValue("44071 練馬");
    expect(screen.getByLabelText("気温（℃）")).toBeDisabled();
  });

  it("方式を選ばずに予測するとエラーを出す", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByRole("button", { name: "予測する" });

    await user.click(screen.getByRole("button", { name: "予測する" }));
    expect(screen.getByText("距離の指定方法を選んでください")).toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("距離と手動気象を選んで予測できる", async () => {
    const user = userEvent.setup();
    render(<PredictPage />);
    await screen.findByLabelText("距離（km）");

    await user.click(screen.getByLabelText("距離を指定して予測"));
    await user.click(screen.getByLabelText("気温・湿度を入力する"));
    await user.click(screen.getByRole("button", { name: "予測する" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalledWith(
        "/api/predict",
        "POST",
        expect.objectContaining({
          distance_mode: "custom",
          distance_km: 5,
          mode: "manual",
          temperature_c: 20,
          humidity_pct: 60,
          intensity: "medium",
        }),
      );
    });
    expect(screen.getByText("5'29\"/km")).toBeInTheDocument();
    expect(screen.getByText("27:24")).toBeInTheDocument();
  });
});
