import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StationPicker } from "../components/StationPicker";
import { stationsFixture } from "./fixtures";

describe("StationPicker", () => {
  it("地点名で絞り込む", async () => {
    const user = userEvent.setup();
    render(<StationPicker stations={stationsFixture} value="44071" onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("地点の絞り込み"), "東京");

    const select = screen.getByLabelText("アメダス地点");
    expect(select).toHaveDisplayValue("44071 練馬");
    expect(screen.getByRole("option", { name: "44132 東京" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "11001 宗谷岬" })).not.toBeInTheDocument();
  });

  it("無効のときは入力できない", () => {
    render(
      <StationPicker stations={stationsFixture} value="44071" onChange={vi.fn()} disabled label="予報の地点" />,
    );

    expect(screen.getByLabelText("地点の絞り込み")).toBeDisabled();
    expect(screen.getByLabelText("予報の地点")).toBeDisabled();
  });
});
