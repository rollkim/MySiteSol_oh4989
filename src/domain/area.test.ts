import { describe, expect, it } from "vitest";

import { formatArea } from "./area";

describe("formatArea", () => {
  it("㎡ + 평 병기 (평 = ㎡ / 3.3058, 소수 1자리)", () => {
    expect(formatArea("84.9")).toBe("84.9㎡ (25.7평)");
    expect(formatArea("33.0")).toBe("33㎡ (10평)");
  });
  it("잘못된 문자열은 throw — numeric 컬럼이 string으로 오는 것을 전제", () => {
    expect(() => formatArea("abc")).toThrow();
    expect(() => formatArea("-10")).toThrow();
  });
});
