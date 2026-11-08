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
    mockedSend.mockReset();
    mockedSend.mockResolvedValue(profileFixture);
  });

  it("モーダルに強度別心拍と個人記録の重みを出す", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(await screen.findByRole("button", { name: "高度な設定" })).toBeInTheDocument();
    expect(screen.queryByText(/ユーザー情報と、予測/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("低強度（60〜70%）")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高度な設定" }));

    expect(screen.getByRole("dialog", { name: "高度な設定" })).toBeInTheDocument();
    expect(screen.getByLabelText("低強度（60〜70%）")).toHaveValue(123);
    expect(screen.getByLabelText("5km（90〜100%）")).toHaveValue(180);
    const prior = screen.getByLabelText("個人記録の重み設定");
    expect(prior).toHaveValue(10);

    const priorHelp = screen.getByText(/有効件数 \+ K/);
    expect(priorHelp.closest(".help-pop")).not.toBeNull();
    expect(screen.getByText(/許可が取れない/).closest(".help-pop")).not.toBeNull();
    expect(screen.getByText(/個別に上書きできます/).closest(".help-pop")).not.toBeNull();
    expect(screen.queryByText(/許可が取れない/, { selector: "p" })).not.toBeInTheDocument();
    const race = screen.getByRole("heading", { name: "レースペース心拍数" }).closest("section");
    const priorSection = screen.getByRole("heading", { name: /個人記録の重み設定/ }).closest("section");
    expect(race).toHaveClass("settings-modal__section--spaced");
    expect(priorSection).toHaveClass("settings-modal__section--spaced");

    await user.click(screen.getByRole("button", { name: "個人記録の重み設定の説明" }));
    expect(priorHelp.closest(".help.open")).not.toBeNull();

    await user.clear(prior);
    await user.type(prior, "20");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存", exact: true }));
    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
    });
    expect(mockedSend.mock.calls[0][2]).toMatchObject({ personal_prior_k: 10, intensities: { low: 123 } });
  });

  it("保存するで下書きを確定し、画面の保存でデータベースへ送る", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(await screen.findByRole("button", { name: "高度な設定" }));
    const prior = screen.getByLabelText("個人記録の重み設定");
    await user.clear(prior);
    await user.type(prior, "20");
    await user.click(screen.getByRole("button", { name: "保存する" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "高度な設定" }));
    expect(screen.getByLabelText("個人記録の重み設定")).toHaveValue(20);
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await user.click(screen.getByRole("button", { name: "保存", exact: true }));
    await waitFor(() => {
      expect(mockedSend).toHaveBeenCalled();
    });
    expect(mockedSend.mock.calls[0][2]).toMatchObject({ personal_prior_k: 20 });
  });

  it("デフォルト設定に戻すと誕生日からの目安と重み初期値に戻る", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SettingsPage />);

    await user.click(await screen.findByRole("button", { name: "高度な設定" }));
    const prior = screen.getByLabelText("個人記録の重み設定");
    const low = screen.getByLabelText("低強度（60〜70%）");
    await user.clear(prior);
    await user.type(prior, "20");
    await user.clear(low);
    await user.type(low, "100");
    await user.click(screen.getByRole("radio", { name: /GPS で近くのアメダスを探す/ }));

    await user.click(screen.getByRole("button", { name: "デフォルト設定に戻す" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(prior).toHaveValue(10);
    expect(low).toHaveValue(123);
    expect(screen.getByRole("spinbutton", { name: "最大心拍数" })).toHaveValue(189);
    expect(screen.getByRole("radio", { name: /設定どおりのアメダスを出す/ })).toBeChecked();

    confirmSpy.mockRestore();
  });
});
