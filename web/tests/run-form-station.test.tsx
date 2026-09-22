import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunForm } from "../components/RunForm";
import { profileFixture, stationsFixture } from "./fixtures";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet } from "../lib/api";

const mockedGet = vi.mocked(apiGet);

function mockGeolocation(coords: { latitude: number; longitude: number } | "denied") {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (position: GeolocationPosition) => void,
        error: (err: GeolocationPositionError) => void,
      ) => {
        if (coords === "denied") {
          error({ code: 1, message: "denied", PERMISSION_DENIED: 1 } as GeolocationPositionError);
          return;
        }
        success({ coords } as GeolocationPosition);
      },
    },
  });
}

describe("記録追加の初期地点", () => {
  beforeEach(() => {
    mockedGet.mockImplementation(async (path: string) => {
      if (path === "/api/profile") {
        return { ...profileFixture, run_station_init: "gps", amedas_station_id: "44132" };
      }
      if (path === "/api/amedas/stations") {
        return stationsFixture;
      }
      throw new Error(`unexpected ${path}`);
    });
  });

  it("GPS 設定なら最寄りを初期値にする", async () => {
    mockGeolocation({ latitude: 35.74, longitude: 139.65 });
    render(<RunForm title="記録を追加" onCancel={() => undefined} onSuccess={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByLabelText("アメダス")).toHaveDisplayValue("44071 練馬");
    });
  });

  it("GPS を拒否しても設定地点で追加できる", async () => {
    mockGeolocation("denied");
    mockedGet.mockImplementation(async (path: string) => {
      if (path === "/api/profile") {
        return { ...profileFixture, run_station_init: "gps", amedas_station_id: "44071" };
      }
      if (path === "/api/amedas/stations") {
        return stationsFixture;
      }
      throw new Error(`unexpected ${path}`);
    });

    render(<RunForm title="記録を追加" onCancel={() => undefined} onSuccess={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByLabelText("アメダス")).toHaveDisplayValue("44071 練馬");
    });
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });
});
