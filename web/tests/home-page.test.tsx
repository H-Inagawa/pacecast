import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("ホーム", () => {
  it("カード導線が指定の並びで出る", () => {
    render(<HomePage />);

    const predict = screen.getByRole("link", { name: /パフォーマンスを予測/ });
    const runs = screen.getByRole("link", { name: /走行記録/ });
    const forecast = screen.getByRole("link", { name: /ランニング天気予報/ });
    const analyze = screen.getByRole("link", { name: /^分析結果$/ });
    const about = screen.getByRole("button", { name: /PaceCastとは？/ });

    expect(predict).toHaveAttribute("href", "/predict");
    expect(runs).toHaveAttribute("href", "/runs");
    expect(forecast).toHaveAttribute("href", "/forecast");
    expect(analyze).toHaveAttribute("href", "/analyze");

    const cards = [predict, runs, forecast, analyze, about];
    for (let i = 1; i < cards.length; i += 1) {
      expect(
        cards[i - 1].compareDocumentPosition(cards[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("見出しとカード内リードが Figma の文言と一致する", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "天気から、走りを予報する。" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /過去のランニング記録と気象データから、未来の走りを予測します。/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /過去のランニング記録を表示します。/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /気象データによる走りやすさを予報します。/ })).toBeInTheDocument();
  });

  it("PaceCastとは？を開くと概要と各画面の説明が出る", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /PaceCastとは？/ }));

    const dialog = screen.getByRole("dialog", { name: "PaceCastとは？" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("過去の走行記録と、そのときの気象から");
    expect(dialog).toHaveTextContent("走行記録");
    expect(dialog).toHaveTextContent("パフォーマンスを予測");
    expect(dialog).toHaveTextContent("ランニング天気予報");
    expect(dialog).toHaveTextContent("分析結果");
    expect(dialog).toHaveTextContent("設定");
    expect(dialog).toHaveTextContent("Open-Meteo");
    expect(dialog).toHaveTextContent("ライセンスは、まだ決めていません");
  });

  it("閉じるで説明モーダルを閉じる", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: /PaceCastとは？/ }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog", { name: "PaceCastとは？" })).not.toBeInTheDocument();
  });
});
