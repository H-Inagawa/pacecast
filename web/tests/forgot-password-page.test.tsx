import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "../app/forgot-password/page";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);

describe("パスワード再設定の依頼", () => {
  beforeEach(() => {
    mockedSend.mockReset();
  });

  it("未登録でも同じ案内を出す", async () => {
    mockedSend.mockResolvedValue({
      message: "入力したメールアドレスにアカウントがあれば、再設定用のリンクを送りました。",
    });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "再設定リンクを送る" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/forgot-password", "POST", {
      email: "nobody@example.com",
    });
    expect(
      await screen.findByText("入力したメールアドレスにアカウントがあれば、再設定用のリンクを送りました。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "パスワード再設定のリンクを開く" })).not.toBeInTheDocument();
  });

  it("SMTP 未設定のときは画面にリンクを出す", async () => {
    mockedSend.mockResolvedValue({
      message: "再設定メールの送信設定が無いので、下のリンクを開いてパスワードを変えてください。",
      reset_url: "http://127.0.0.1:3000/reset-password?token=abc",
    });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "runner@example.com");
    await user.click(screen.getByRole("button", { name: "再設定リンクを送る" }));

    expect(await screen.findByRole("link", { name: "パスワード再設定のリンクを開く" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:3000/reset-password?token=abc",
    );
  });
});
