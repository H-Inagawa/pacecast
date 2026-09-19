import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.queryByRole("button", { name: "GPSで探す" })).not.toBeInTheDocument();
  });

  it("GPSで探すと最寄りの地点を入れる", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: (position: GeolocationPosition) => void) => {
          success({ coords: { latitude: 35.74, longitude: 139.65 } } as GeolocationPosition);
        },
      },
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onGpsMessage = vi.fn();
    render(
      <StationPicker
        stations={stationsFixture}
        value="44132"
        onChange={onChange}
        allowGps
        onGpsMessage={onGpsMessage}
      />,
    );

    const button = await screen.findByRole("button", { name: "GPSで探す" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(onChange).toHaveBeenCalledWith("44071");
    expect(onGpsMessage).toHaveBeenCalledWith("練馬（44071）を選びました", "ok");
  });

  it("位置情報を拒否しても今の地点は残す", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (err: GeolocationPositionError) => void) => {
          error({ code: 1, message: "denied", PERMISSION_DENIED: 1 } as GeolocationPositionError);
        },
      },
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onGpsMessage = vi.fn();
    render(
      <StationPicker
        stations={stationsFixture}
        value="44132"
        onChange={onChange}
        allowGps
        onGpsMessage={onGpsMessage}
      />,
    );

    const button = await screen.findByRole("button", { name: "GPSで探す" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(onChange).not.toHaveBeenCalled();
    expect(onGpsMessage).toHaveBeenCalledWith("位置情報の利用が許可されていません", "error");
    expect(screen.getByLabelText("アメダス地点")).toHaveDisplayValue("44132 東京");
  });
});
