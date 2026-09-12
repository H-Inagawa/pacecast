import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawerMenu } from "../components/DrawerMenu";

const pathname = vi.fn(() => "/predict");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}));

describe("DrawerMenu", () => {
  beforeEach(() => {
    pathname.mockReturnValue("/predict");
  });

  it("ヘッダ左のボタンから開き、今の画面は選べない", async () => {
    const user = userEvent.setup();
    render(<DrawerMenu />);

    await user.click(screen.getByRole("button", { name: "メニュー" }));

    const nav = screen.getByRole("navigation", { name: "サイト内メニュー" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("パフォーマンスを予測")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "パフォーマンスを予測" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "走行記録" })).toHaveAttribute("href", "/runs");
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("背景クリックで閉じる", async () => {
    const user = userEvent.setup();
    const { container } = render(<DrawerMenu />);

    await user.click(screen.getByRole("button", { name: "メニュー" }));
    await user.click(container.querySelector(".drawer-backdrop") as HTMLElement);

    expect(screen.queryByRole("navigation", { name: "サイト内メニュー" })).not.toBeInTheDocument();
  });
});
