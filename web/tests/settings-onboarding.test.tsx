import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../app/settings/page";
import { profileFixture, stationsFixture } from "./fixtures";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push }),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedGet = vi.mocked(apiGet);
const mockedSend = vi.mocked(apiSend);

describe("初回のユーザー設定", () => {
  beforeEach(() => {
    push.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedGet.mockImplementation(async (path: string) => {
      if (path === "/api/profile") {
        return {
          ...profileFixture,
          display_name: null,
          birthday: null,
          onboarding_complete: false,
        };
      }
      if (path === "/api/amedas/stations") {
        return stationsFixture;
      }
      throw new Error(`unexpected ${path}`);
    });
    mockedSend.mockResolvedValue({ ...profileFixture, onboarding_complete: true });
  });

  it("名前と誕生日を入れて保存するとホームへ進む", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "ユーザー設定" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ホームへ戻る" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("ユーザー名"), "テスト");
    await user.type(screen.getByLabelText("誕生日"), "1995-09-12");
    await user.click(screen.getByRole("button", { name: "保存して始める" }));

    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/");
    });
  });
});
