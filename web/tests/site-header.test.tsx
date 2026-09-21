import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../components/SiteHeader";

vi.mock("../components/DrawerMenu", () => ({
  DrawerMenu: () => (
    <button type="button" aria-label="メニュー">
      トグル
    </button>
  ),
}));

describe("SiteHeader", () => {
  it("中央にロゴとユーザー名を出す", () => {
    render(<SiteHeader signedIn onboarding={false} displayName="開発テスト１" homeHref="/" />);

    expect(screen.getByText("PaceCast")).toBeInTheDocument();
    expect(screen.getByText("開発テスト１ さん")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "メニュー" })).toBeInTheDocument();
  });
});
