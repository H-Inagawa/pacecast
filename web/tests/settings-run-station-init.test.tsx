import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import { profileFixture, stationsFixture } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedGet = vi.mocked(apiGet);
const mockedSend = vi.mocked(apiSend);

describe("走行追加の初期地点設定", () => {
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
    mockedSend.mockResolvedValue({ ...profileFixture, run_station_init: "gps" });
  });

  it("GPS 初期地点を保存できる", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const gps = await screen.findByLabelText("GPS で近くのアメダスを探す");
    expect(screen.getByLabelText("設定どおりのアメダスを出す")).toBeChecked();
    await user.click(gps);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
    });
    expect(mockedSend.mock.calls[0][2]).toMatchObject({ run_station_init: "gps" });
  });
});
