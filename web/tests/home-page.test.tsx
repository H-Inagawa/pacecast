import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("ホーム", () => {
  it("分析結果への導線がある", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "分析結果を見る" })).toHaveAttribute("href", "/analyze");
  });
});
