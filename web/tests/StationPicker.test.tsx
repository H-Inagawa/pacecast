import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StationPicker } from "../components/StationPicker";
import { stationsFixture } from "./fixtures";

describe("StationPicker", () => {
  it("都道府県を選ぶとその候補だけが出る", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StationPicker stations={stationsFixture} value="44071" onChange={onChange} />);

    expect(screen.getByLabelText("都道府県")).toHaveDisplayValue("東京都");
    expect(screen.getByLabelText("アメダス地点")).toHaveDisplayValue("44071 練馬");
    expect(screen.getByRole("option", { name: "44132 東京" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "11001 宗谷岬" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("都道府県"), "北海道");
    expect(onChange).toHaveBeenCalledWith("11001");
  });

  it("無効のときは入力できない", () => {
    render(
      <StationPicker stations={stationsFixture} value="44071" onChange={vi.fn()} disabled label="予報の地点" />,
    );

    expect(screen.getByLabelText("都道府県")).toBeDisabled();
    expect(screen.getByLabelText("予報の地点")).toBeDisabled();
  });
});
