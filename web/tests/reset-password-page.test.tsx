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

  it("パスワードが違うと送らない", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("新しいパスワード（8文字以上）"), "secret123");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "secret999");
    await user.click(screen.getByRole("button", { name: "パスワードを変更する" }));

    expect(screen.getByText("パスワードが一致しません")).toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("トークンと新しいパスワードを送る", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("新しいパスワード（8文字以上）"), "secret123");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "secret123");
    await user.click(screen.getByRole("button", { name: "パスワードを変更する" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/reset-password", "POST", {
      token: "abc",
      password: "secret123",
    });
  });
});
