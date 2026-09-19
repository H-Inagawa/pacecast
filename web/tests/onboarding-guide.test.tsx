import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingGuide } from "../components/OnboardingGuide";

const pathname = vi.fn(() => "/register");
const search = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useSearchParams: () => search(),
}));

describe("登録の案内", () => {
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
});
