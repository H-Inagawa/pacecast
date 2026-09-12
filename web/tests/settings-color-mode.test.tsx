import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import { profileFixture, stationsFixture } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedGet = vi.mocked(apiGet);
const mockedSend = vi.mocked(apiSend);

describe("設定の色分け", () => {
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
    mockedSend.mockResolvedValue({ ...profileFixture, row_color_mode: "wbgt" });
  });

  it("心拍・気象・しないを選べる", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const weather = await screen.findByLabelText("気象条件（WBGT）");
    expect(screen.getByLabelText("心拍")).toBeEnabled();
    expect(screen.getByLabelText("色分けしない")).toBeInTheDocument();

    await user.click(weather);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
    });
    expect(mockedSend.mock.calls[0][2]).toMatchObject({ row_color_mode: "wbgt" });
  });
});
