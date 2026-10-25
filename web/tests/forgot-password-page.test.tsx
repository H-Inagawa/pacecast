import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "../app/forgot-password/page";
import { PASSWORD_RESET_INVALID_MESSAGE, PASSWORD_RESET_SENT_MESSAGE } from "../lib/auth";

const search = vi.hoisted(() => ({ value: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);

describe("パスワード再設定の依頼", () => {
  beforeEach(() => {
    search.value = "";
    mockedSend.mockReset();
  });

  it("アイブロウは出さず、未登録でも同じ案内を出す", async () => {
    mockedSend.mockResolvedValue({ message: PASSWORD_RESET_SENT_MESSAGE });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    expect(screen.queryByText("PACECAST")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("メールアドレス"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "再設定リンクを送る" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/forgot-password", "POST", {
      email: "nobody@example.com",
    });
    expect(await screen.findByText(PASSWORD_RESET_SENT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "パスワード再設定のリンクを開く" })).not.toBeInTheDocument();
  });

  it("無効なリンクからは依頼画面で送り直す", () => {
    search.value = "invalid=1";
    render(<ForgotPasswordPage />);

    expect(screen.getByText(PASSWORD_RESET_INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.queryByLabelText("新しいパスワード（8文字以上）")).not.toBeInTheDocument();
  });
});
