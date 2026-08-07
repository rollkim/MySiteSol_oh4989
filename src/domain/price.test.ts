import { describe, expect, it } from "vitest";

import {
  formatMaintenanceFee,
  formatManwon,
  formatPremiumFee,
  formatPropertyPrice,
} from "./price";

describe("formatManwon", () => {
  it("억 미만은 콤마 숫자", () => {
    expect(formatManwon(3100)).toBe("3,100");
    expect(formatManwon(500)).toBe("500");
    expect(formatManwon(0)).toBe("0");
  });
  it("억 단위 조합", () => {
    expect(formatManwon(43000)).toBe("4억 3,000");
    expect(formatManwon(150000)).toBe("15억");
    expect(formatManwon(25000)).toBe("2억 5,000");
    expect(formatManwon(100000)).toBe("10억");
  });
  it("만원 정수가 아니면 throw (RULE-11 — 부동소수점·문자열 금지의 마지막 방어선)", () => {
    expect(() => formatManwon(1.5)).toThrow();
    expect(() => formatManwon(-100)).toThrow();
    expect(() => formatManwon(NaN)).toThrow();
  });
});

describe("formatPropertyPrice", () => {
  const base = { salePrice: null, deposit: null, monthlyRent: null };
  it("매매 = salePrice", () => {
    expect(formatPropertyPrice({ ...base, dealType: "SALE", salePrice: 43000 })).toBe("4억 3,000");
  });
  it("전세 = deposit", () => {
    expect(formatPropertyPrice({ ...base, dealType: "JEONSE", deposit: 30000 })).toBe("3억");
  });
  it("월세·단기 = 보증금/월세 (디자인가이드 '월세 500/45')", () => {
    expect(formatPropertyPrice({ ...base, dealType: "MONTHLY", deposit: 500, monthlyRent: 45 })).toBe("500/45");
    expect(formatPropertyPrice({ ...base, dealType: "MONTHLY", deposit: 10000, monthlyRent: 60 })).toBe("1억/60");
    expect(formatPropertyPrice({ ...base, dealType: "SHORT", deposit: 100, monthlyRent: 80 })).toBe("100/80");
  });
  it("가격이 비어 있으면(작성 중 HIDDEN) '가격 협의'", () => {
    expect(formatPropertyPrice({ ...base, dealType: "SALE" })).toBe("가격 협의");
    expect(formatPropertyPrice({ ...base, dealType: "MONTHLY", deposit: 500 })).toBe("가격 협의");
  });
});

describe("formatMaintenanceFee", () => {
  it("만원 정수 → '월 10만원'", () => {
    expect(formatMaintenanceFee(10)).toBe("월 10만원");
  });
  it("0 또는 null → '없음' (관리비 없는 매물의 법정 표기)", () => {
    expect(formatMaintenanceFee(0)).toBe("없음");
    expect(formatMaintenanceFee(null)).toBe("없음");
  });
});

describe("formatPremiumFee (상가 권리금)", () => {
  it("0 = '없음'(정보), null = 빈 문자열(미기재 — 행 생략용)", () => {
    expect(formatPremiumFee(0)).toBe("없음");
    expect(formatPremiumFee(null)).toBe("");
    expect(formatPremiumFee(3000)).toBe("3,000만원");
    expect(formatPremiumFee(15000)).toBe("1억 5,000만원");
  });
});
