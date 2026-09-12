import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../app/login/page";
import { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD } from "../lib/auth";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);

describe("ログイン", () => {
  beforeEach(() => {
    mockedSend.mockReset();
    mockedSend.mockResolvedValue({ id: 1, email: DEV_LOGIN_EMAIL });
  });

  it("開発者用の固定情報を案内する", () => {
    render(<LoginPage />);
    expect(screen.getByText(DEV_LOGIN_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(DEV_LOGIN_PASSWORD)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute("href", "/register");
  });

  it("メールとパスワードを送る", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), DEV_LOGIN_EMAIL);
    await user.type(screen.getByLabelText("パスワード"), DEV_LOGIN_PASSWORD);
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/login", "POST", {
      email: DEV_LOGIN_EMAIL,
      password: DEV_LOGIN_PASSWORD,
    });
  });
});
