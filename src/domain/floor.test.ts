import { describe, expect, it } from "vitest";

import { floorBand, formatFloor } from "./floor";

describe("formatFloor — §8 건물유형 3분기", () => {
  it("단독·다가구(TOTAL_ONLY)는 총층만", () => {
    expect(
      formatFloor({ buildingType: "DETACHED", floor: null, totalFloor: 2, floorDisplay: "EXACT" }),
    ).toBe("총 2층");
    // floor 값이 있어도 무시한다 — 법정 표기는 총층만
    expect(
      formatFloor({ buildingType: "DETACHED", floor: 1, totalFloor: 2, floorDisplay: "EXACT" }),
    ).toBe("총 2층");
  });
  it("그 외 주택(EXACT)은 해당층/총층", () => {
    expect(
      formatFloor({ buildingType: "APT", floor: 3, totalFloor: 15, floorDisplay: "EXACT" }),
    ).toBe("3/15층");
  });
  it("EXACT + 저/중/고 대체", () => {
    expect(
      formatFloor({ buildingType: "APT", floor: 2, totalFloor: 15, floorDisplay: "LOW_MID_HIGH" }),
    ).toBe("저/15층");
    expect(
      formatFloor({ buildingType: "VILLA", floor: 8, totalFloor: 15, floorDisplay: "LOW_MID_HIGH" }),
    ).toBe("중/15층");
    expect(
      formatFloor({
        buildingType: "OFFICETEL",
        floor: 14,
        totalFloor: 15,
        floorDisplay: "LOW_MID_HIGH",
      }),
    ).toBe("고/15층");
  });
  it("상가·사무실(EXACT_STRICT)은 저/중/고를 요청해도 정확 표기 — 법정 대체 불가", () => {
    expect(
      formatFloor({ buildingType: "STORE", floor: 2, totalFloor: 5, floorDisplay: "LOW_MID_HIGH" }),
    ).toBe("2/5층");
    expect(
      formatFloor({ buildingType: "OFFICE", floor: 7, totalFloor: 10, floorDisplay: "LOW_MID_HIGH" }),
    ).toBe("7/10층");
  });
  it("지하층은 B 표기", () => {
    expect(
      formatFloor({ buildingType: "STORE", floor: -1, totalFloor: 5, floorDisplay: "EXACT" }),
    ).toBe("B1/5층");
  });
  it("EXACT인데 floor가 비어 있으면(작성 중) 총층만으로 강등", () => {
    expect(
      formatFloor({ buildingType: "APT", floor: null, totalFloor: 15, floorDisplay: "EXACT" }),
    ).toBe("총 15층");
  });
  it("토지 등 총층 0은 표기 생략", () => {
    expect(
      formatFloor({ buildingType: "LAND", floor: null, totalFloor: 0, floorDisplay: "EXACT" }),
    ).toBe("-");
  });
});

describe("floorBand — 총층 3등분(올림 경계)", () => {
  it("15층: 1~5 저 / 6~10 중 / 11~15 고", () => {
    expect(floorBand(1, 15)).toBe("저");
    expect(floorBand(5, 15)).toBe("저");
    expect(floorBand(6, 15)).toBe("중");
    expect(floorBand(10, 15)).toBe("중");
    expect(floorBand(11, 15)).toBe("고");
    expect(floorBand(15, 15)).toBe("고");
  });
  it("지하·반지하는 항상 저", () => {
    expect(floorBand(-1, 15)).toBe("저");
    expect(floorBand(0, 15)).toBe("저");
  });
});
