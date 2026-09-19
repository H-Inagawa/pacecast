import { describe, expect, it } from "vitest";
import { initialRunStationId, normalizeRunStationInit } from "../lib/run-station-init";
import { stationsFixture } from "./fixtures";

describe("走行追加の初期地点", () => {
  it("不明な値は設定地点にする", () => {
    expect(normalizeRunStationInit(undefined)).toBe("profile");
    expect(normalizeRunStationInit("gps")).toBe("gps");
  });

  it("設定どおりならプロフィール地点を返す", async () => {
    await expect(
      initialRunStationId({
        mode: "profile",
        profileStationId: "44071",
        stations: stationsFixture,
        requestPosition: async () => {
          throw new Error("呼ばない");
        },
      }),
    ).resolves.toBe("44071");
  });

  it("GPS なら最寄りの観測所を返す", async () => {
    await expect(
      initialRunStationId({
        mode: "gps",
        profileStationId: "44132",
        stations: stationsFixture,
        requestPosition: async () => ({ latitude: 35.74, longitude: 139.65 }),
      }),
    ).resolves.toBe("44071");
  });

  it("GPS が失敗したら設定地点に戻す", async () => {
    await expect(
      initialRunStationId({
        mode: "gps",
        profileStationId: "44071",
        stations: stationsFixture,
        requestPosition: async () => {
          throw new Error("位置情報の利用が許可されていません");
        },
      }),
    ).resolves.toBe("44071");
  });
});
