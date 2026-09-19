import { describe, expect, it } from "vitest";
import { prefectureFromStationId, prefecturesInStations } from "../lib/amedas-prefecture";

describe("アメダスの都道府県", () => {
  it("観測所番号の先頭2桁から都道府県が分かる", () => {
    expect(prefectureFromStationId("44132")).toBe("東京都");
    expect(prefectureFromStationId("44071")).toBe("東京都");
    expect(prefectureFromStationId("11001")).toBe("北海道");
    expect(prefectureFromStationId("91011")).toBe("沖縄県");
    expect(prefectureFromStationId("")).toBe("");
  });

  it("地点一覧にある都道府県だけを北から出す", () => {
    expect(prefecturesInStations(["11001", "44132", "44071"])).toEqual(["北海道", "東京都"]);
  });
});
