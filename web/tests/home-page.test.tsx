import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("ホーム", () => {
  it("分析結果への導線がある", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "分析結果を見る" })).toHaveAttribute("href", "/analyze");
  });

  it("PaceCastとは？を開くと概要と各画面の説明が出る", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "PaceCastとは？" }));

    const dialog = screen.getByRole("dialog", { name: "PaceCastとは？" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("過去の走行記録と、そのときの気象から");
    expect(dialog).toHaveTextContent("走行記録");
    expect(dialog).toHaveTextContent("パフォーマンスを予測");
    expect(dialog).toHaveTextContent("分析結果");
    expect(dialog).toHaveTextContent("設定");
    expect(dialog).toHaveTextContent("Open-Meteo");
    expect(dialog).toHaveTextContent("ライセンスは、まだ決めていません");
  });

  it("閉じるで説明モーダルを閉じる", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "PaceCastとは？" }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog", { name: "PaceCastとは？" })).not.toBeInTheDocument();
  });
});
