import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "../app/reset-password/page";

const navigation = vi.hoisted(() => ({
  token: "abc",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.token ? `token=${navigation.token}` : ""),
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedSend = vi.mocked(apiSend);
const mockedGet = vi.mocked(apiGet);

describe("新しいパスワード", () => {
  beforeEach(() => {
    navigation.token = "abc";
    navigation.replace.mockReset();
    mockedSend.mockReset();
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ ok: true });
    mockedSend.mockResolvedValue({ id: 1, email: "runner@example.com", onboarding_complete: true });
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("パスワードは1回入力し、表示して確認できる", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    const password = await screen.findByLabelText("新しいパスワード（8文字以上）");
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

    await user.type(await screen.findByLabelText("新しいパスワード（8文字以上）"), "secret123");
    await user.click(screen.getByRole("button", { name: "パスワードを変更する" }));

    expect(mockedSend).toHaveBeenCalledWith("/api/auth/reset-password", "POST", {
      token: "abc",
      password: "secret123",
    });
  });

  it("トークンが無いときは依頼画面へ戻す", async () => {
    navigation.token = "";
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/forgot-password?invalid=1");
    });
    expect(screen.queryByLabelText("新しいパスワード（8文字以上）")).not.toBeInTheDocument();
  });

  it("無効なトークンではパスワードを入力させない", async () => {
    mockedGet.mockRejectedValue(new Error("再設定リンクが無効です"));
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/forgot-password?invalid=1");
    });
    expect(screen.queryByLabelText("新しいパスワード（8文字以上）")).not.toBeInTheDocument();
  });
});
