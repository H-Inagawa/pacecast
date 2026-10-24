import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingGuide } from "../components/OnboardingGuide";

const pathname = vi.fn(() => "/register");
const search = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useSearchParams: () => search(),
}));

describe("登録の案内", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ヘッダに3段階の流れを出す", () => {
    pathname.mockReturnValue("/register");
    search.mockReturnValue(new URLSearchParams());
    render(<OnboardingGuide />);

    const nav = screen.getByRole("navigation", { name: "登録の流れ" });
    expect(nav).toHaveTextContent("メールアドレス入力");
    expect(nav).toHaveTextContent("メール確認");
    expect(nav).toHaveTextContent("ユーザー設定入力");
    expect(screen.getByText("メールアドレス入力")).toHaveAttribute("aria-current", "step");
  });

  it("ログインでは出さない", () => {
    pathname.mockReturnValue("/login");
    search.mockReturnValue(new URLSearchParams());
    render(<OnboardingGuide />);

    expect(screen.queryByRole("navigation", { name: "登録の流れ" })).not.toBeInTheDocument();
  });

  it("設定未完了の設定画面ではユーザー設定入力を出す", async () => {
    pathname.mockReturnValue("/settings");
    search.mockReturnValue(new URLSearchParams());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ needs_settings: true }),
      }),
    );
    render(<OnboardingGuide />);

    const nav = await screen.findByRole("navigation", { name: "登録の流れ" });
    expect(nav).toHaveTextContent("ユーザー設定入力");
    expect(screen.getByText("ユーザー設定入力")).toHaveAttribute("aria-current", "step");
  });

  it("設定が済んだ設定画面では出さない", async () => {
    pathname.mockReturnValue("/settings");
    search.mockReturnValue(new URLSearchParams());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ needs_settings: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<OnboardingGuide />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("navigation", { name: "登録の流れ" })).not.toBeInTheDocument();
  });
});
