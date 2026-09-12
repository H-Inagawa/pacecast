import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../app/register/page";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);

describe("新規登録", () => {
  beforeEach(() => {
    mockedSend.mockReset();
  });

  it("パスワードが違うと送らない", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "runner@example.com");
    await user.type(screen.getByLabelText("パスワード（8文字以上）"), "secret123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "secret999");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(screen.getByText("パスワードが一致しません")).toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("確認リンクを案内する", async () => {
    mockedSend.mockResolvedValue({
      message: "確認メールの送信設定が無いので、下のリンクを開いて確認してください。",
      verification_url: "http://127.0.0.1:3000/verify?token=abc",
    });
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "runner@example.com");
    await user.type(screen.getByLabelText("パスワード（8文字以上）"), "secret123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "secret123");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/register", "POST", {
      email: "runner@example.com",
      password: "secret123",
    });
    expect(await screen.findByRole("link", { name: "メール確認のリンクを開く" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:3000/verify?token=abc",
    );
  });
});
