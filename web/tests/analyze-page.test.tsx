import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyzePage from "../app/analyze/page";
import type { Run } from "../lib/types";

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from "../lib/api";

const mockedGet = vi.mocked(apiGet);

const readyRun: Run = {
  id: 3,
  started_at: "2026-09-03 07:00",
  distance_km: 5,
  duration_sec: 1700,
  hours: 0,
  minutes: 28,
  seconds: 20,
  avg_heart_rate: 150,
  notes: null,
  pace_sec_per_km: 340,
  weather: { temperature_c: 24, humidity_pct: 70, observed_at: "2026-09-03 07:00", wbgt_c: 22.1 },
  hr_zone: null,
  weather_zone: null,
  amedas_station_id: "44071",
  amedas_station_name: "練馬",
};

describe("分析結果", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("WBGT 付きの走が無いときは空表示にする", async () => {
    mockedGet.mockResolvedValue([]);
    render(<AnalyzePage />);
    expect(await screen.findByText("WBGT 付きの走行がまだありません。")).toBeInTheDocument();
  });

  it("WBGT 付きの走があれば散布図を出す", async () => {
    mockedGet.mockResolvedValue([readyRun]);
    render(<AnalyzePage />);
    expect(await screen.findByText("WBGT 付きの走行: 1 件")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "推定 WBGT と走行ペースの散布図" })).toBeInTheDocument();
  });
});
