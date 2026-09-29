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

describe("高度な設定", () => {
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
    mockedSend.mockResolvedValue(profileFixture);
  });

  it("モーダルに強度別心拍と個人記録の重みを出す", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(await screen.findByRole("button", { name: "高度な設定" })).toBeInTheDocument();
    expect(screen.queryByLabelText("低強度（60〜70%）")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高度な設定" }));

    expect(screen.getByRole("dialog", { name: "高度な設定" })).toBeInTheDocument();
    expect(screen.getByLabelText("低強度（60〜70%）")).toHaveValue(123);
    expect(screen.getByLabelText("5km（90〜100%）")).toHaveValue(180);
    const prior = screen.getByLabelText("個人記録の重み設定");
    expect(prior).toHaveValue(10);

    await user.click(screen.getByRole("button", { name: "個人記録の重み設定の説明" }));
    expect(screen.getByText(/有効件数 \+ K/)).toBeInTheDocument();

    await user.clear(prior);
    await user.type(prior, "20");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
    });
    expect(mockedSend.mock.calls[0][2]).toMatchObject({ personal_prior_k: 20, intensities: { low: 123 } });
  });
});
