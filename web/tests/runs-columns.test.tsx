import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunsView } from "../app/runs/RunsView";
import { RUN_COLUMNS_STORAGE_KEY } from "../lib/runColumns";
import type { Run } from "../lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("../lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

import { apiGet, apiSend } from "../lib/api";

const mockedGet = vi.mocked(apiGet);
const mockedSend = vi.mocked(apiSend);

const sampleRun: Run = {
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

describe("走行記録の表示項目", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockedSend.mockReset();
    mockedGet.mockResolvedValue([sampleRun]);
    mockedSend.mockResolvedValue(undefined);
  });

  it("下部に表示項目設定があり、日時と距離は外せない", async () => {
    const user = userEvent.setup();
    render(<RunsView />);

    expect(await screen.findByRole("columnheader", { name: "日時" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "距離" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "気温" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "湿度" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /WBGT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WBGTの説明" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "表示項目設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "記録を追加" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ホームへ戻る" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "表示項目設定" }));

    const dialog = screen.getByRole("dialog", { name: "表示項目設定" });
    expect(within(dialog).getByLabelText("日時")).toBeDisabled();
    expect(within(dialog).getByLabelText("距離")).toBeDisabled();
    expect(within(dialog).getByLabelText("日時")).toBeChecked();
    expect(within(dialog).getByLabelText("距離")).toBeChecked();
  });

  it("ペースを外すと列が消え、選択は残る", async () => {
    const user = userEvent.setup();
    render(<RunsView />);
    await screen.findByRole("columnheader", { name: "ペース" });

    await user.click(screen.getByRole("button", { name: "表示項目設定" }));
    await user.click(screen.getByLabelText("ペース"));

    expect(screen.queryByRole("columnheader", { name: "ペース" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "日時" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RUN_COLUMNS_STORAGE_KEY) ?? "{}").pace).toBe(false);
  });

  it("気温を外しても WBGT 列と説明は残る", async () => {
    const user = userEvent.setup();
    render(<RunsView />);
    await screen.findByRole("columnheader", { name: "気温" });

    await user.click(screen.getByRole("button", { name: "表示項目設定" }));
    const dialog = screen.getByRole("dialog", { name: "表示項目設定" });
    expect(within(dialog).getByLabelText("気温")).toBeEnabled();
    expect(within(dialog).getByLabelText("湿度")).toBeEnabled();
    expect(within(dialog).getByLabelText("WBGT")).toBeEnabled();
    await user.click(within(dialog).getByLabelText("気温"));

    expect(screen.queryByRole("columnheader", { name: "気温" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "湿度" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /WBGT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WBGTの説明" })).toBeInTheDocument();
    expect(screen.queryByText("24.0℃")).not.toBeInTheDocument();
  });

  it("WBGT色分けのときは凡例チップを出す", async () => {
    mockedGet.mockResolvedValue([{ ...sampleRun, weather_zone: "comfort" }]);
    render(<RunsView />);
    const legend = await screen.findByRole("list", { name: "WBGTの凡例" });
    expect(within(legend).getByText("凡例:")).toBeInTheDocument();
    const labels = within(legend).getAllByRole("listitem").map((item) => item.textContent);
    expect(labels).toEqual(["暑すぎる", "暑い", "快適", "寒い", "寒すぎる", "未適用"]);
  });

  it("心拍色分けのときは凡例チップを出す", async () => {
    mockedGet.mockResolvedValue([{ ...sampleRun, hr_zone: "high" }]);
    render(<RunsView />);
    const legend = await screen.findByRole("list", { name: "心拍の凡例" });
    expect(within(legend).getByText("凡例:")).toBeInTheDocument();
    const labels = within(legend).getAllByRole("listitem").map((item) => item.textContent);
    expect(labels).toEqual(["70%未満", "70〜80%", "80%以上"]);
    expect(screen.queryByRole("list", { name: "WBGTの凡例" })).not.toBeInTheDocument();
  });

  it("WBGTの説明は改行して全文を出す", async () => {
    const user = userEvent.setup();
    render(<RunsView />);
    await user.click(await screen.findByRole("button", { name: "WBGTの説明" }));
    const pop = screen.getByText(/WBGT（湿球黒球温度）は暑さの指数です。/);
    expect(pop.textContent).toContain("気温・湿度・風速・日射から推定しています。");
    expect(pop.textContent).toContain("環境省の実況推定と同じ式を使っています。");
    expect(pop.className).toContain("help-pop");
  });

  it("削除は確認してから送る", async () => {
    const user = userEvent.setup();
    render(<RunsView />);
    await user.click(await screen.findByRole("button", { name: "削除" }));
    const dialog = screen.getByRole("dialog", { name: "記録を削除してよろしいですか？" });
    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "削除" }));
    expect(mockedSend).toHaveBeenCalledWith("/api/runs/3", "DELETE");
  });
});
