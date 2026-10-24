import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "../app/reset-password/page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("token=abc"),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);

describe("新しいパスワード", () => {
  beforeEach(() => {
    mockedSend.mockReset();
    mockedSend.mockResolvedValue({ id: 1, email: "runner@example.com", onboarding_complete: true });
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("パスワードは1回入力し、表示して確認できる", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    const password = screen.getByLabelText("新しいパスワード（8文字以上）");
    await user.type(password, "secret123");
    expect(screen.queryByLabelText("新しいパスワード（確認）")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "パスワードを表示する" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("secret123");
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("トークンと新しいパスワードを送る", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("新しいパスワード（8文字以上）"), "secret123");
    await user.click(screen.getByRole("button", { name: "パスワードを変更する" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/reset-password", "POST", {
      token: "abc",
      password: "secret123",
    });
  });
});
