import { describe, expect, it } from "vitest";
import { DEFAULT_RUN_COLUMNS, parseRunColumns } from "../lib/runColumns";

describe("走行記録の表示列", () => {
  it("空なら全部出す", () => {
    expect(parseRunColumns(null)).toEqual(DEFAULT_RUN_COLUMNS);
  });

  it("保存したオフを戻す", () => {
    expect(parseRunColumns(JSON.stringify({ pace: false, humidity: false }))).toEqual({
      duration: true,
      pace: false,
      heart_rate: true,
      temperature: true,
      humidity: false,
      wbgt: true,
    });
  });

  it("旧い気象一列のオフを気温・湿度・WBGTに移す", () => {
    expect(parseRunColumns(JSON.stringify({ weather: false }))).toEqual({
      duration: true,
      pace: true,
      heart_rate: true,
      temperature: false,
      humidity: false,
      wbgt: false,
    });
  });
});
