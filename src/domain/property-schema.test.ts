import { describe, expect, it } from "vitest";

import { propertySaveSchema } from "./property-schema";

/** 검증을 통과하는 최소 노출(VISIBLE) 아파트 전세 매물 */
const validBase = {
  title: "배곧 신도시 아파트 전세",
  buildingType: "APT",
  dealType: "JEONSE",
  listingVisibility: "VISIBLE",
  dealProgress: "AVAILABLE",
  displayOrder: 0,
  salePrice: null,
  deposit: 30000,
  monthlyRent: null,
  priceNegotiable: false,
  brokerFeeNote: "법정 상한요율 적용 · 협의",
  exclusiveArea: 84.9,
  supplyArea: null,
  floor: 3,
  totalFloor: 15,
  floorDisplay: "EXACT",
  roomCount: 3,
  bathCount: 2,
  direction: "S",
  directionBase: "안방",
  moveInDate: "즉시입주",
  approvalDate: "2020-05-14",
  parkingTotal: 1,
  parkingPerUnit: null,
  buildingUse: "공동주택",
  maintenanceFee: 10,
  // 관리비 총액이 있으면 3구분 세부 비목도 법정 필수(§8)
  maintenanceDetail: { GENERAL: [{ item: "일반관리비", amount: 7 }], USAGE: [], ETC: [] },
  premiumFee: null,
  businessTypeCurrent: null,
  businessTypeRecommended: null,
  sido: "경기",
  sigungu: "시흥시",
  dong: "배곧동",
  bjdCode: "4139013200",
  jibunAddress: "경기 시흥시 배곧동 123-4",
  roadAddress: null,
  detailAddress: null,
  lat: 37.3799,
  lng: 126.7291,
  mapPinMode: "EXACT",
  naverListingNo: null,
  description: "",
  videoUrl: null,
  videoDuration: null,
  videoSummary: null,
  fieldCheckedAt: null,
  optionCodes: [],
  images: [],
} as const;

describe("propertySaveSchema — 공통", () => {
  it("유효한 노출 매물은 통과", () => {
    expect(propertySaveSchema.safeParse(validBase).success).toBe(true);
  });
  it("가격은 만원 단위 정수만 (RULE-11)", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, deposit: 30000.5 }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, deposit: -1 }).success).toBe(false);
  });
  it("법정동코드는 숫자 10자리", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, bjdCode: "413901320" }).success).toBe(false);
  });
  it("좌표는 한국 범위", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, lat: 50 }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, lng: 100 }).success).toBe(false);
  });
  it("이미지 경로는 저장 패턴만 — 임의 경로로 DB를 오염시키지 못한다", () => {
    const ok = {
      filePath: "properties/202608/0123456789abcdef01234567.jpg",
      thumbPath: "properties/202608/0123456789abcdef01234567-thumb.jpg",
    };
    expect(propertySaveSchema.safeParse({ ...validBase, images: [ok] }).success).toBe(true);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        images: [{ ...ok, filePath: "../../etc/passwd" }],
      }).success,
    ).toBe(false);
  });
});

describe("propertySaveSchema — 거래유형별 가격 (공개 상태에서만 강제)", () => {
  it("SALE인데 salePrice 없으면 거부", () => {
    expect(
      propertySaveSchema.safeParse({ ...validBase, dealType: "SALE", salePrice: null }).success,
    ).toBe(false);
  });
  it("MONTHLY는 보증금+월세 둘 다", () => {
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        dealType: "MONTHLY",
        deposit: 500,
        monthlyRent: null,
      }).success,
    ).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        dealType: "MONTHLY",
        deposit: 500,
        monthlyRent: 45,
      }).success,
    ).toBe(true);
  });
  it("숨김(작성 중)이면 가격이 없어도 저장 가능 — DB CHECK를 안 둔 것과 같은 이유", () => {
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        listingVisibility: "HIDDEN",
        dealType: "SALE",
        salePrice: null,
      }).success,
    ).toBe(true);
  });
  it("가격 협의가 켜져 있으면 금액 없이도 노출 가능 (0원 우회 대신 플래그)", () => {
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        dealType: "SALE",
        salePrice: null,
        priceNegotiable: true,
      }).success,
    ).toBe(true);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        deposit: null,
        priceNegotiable: true,
      }).success,
    ).toBe(true);
  });
});

describe("propertySaveSchema — 건물유형별 층·방향 (ACTIVE)", () => {
  it("EXACT 유형인데 floor 없으면 거부", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, floor: null }).success).toBe(false);
  });
  it("단독(TOTAL_ONLY)은 floor 없어도 통과", () => {
    expect(
      propertySaveSchema.safeParse({ ...validBase, buildingType: "DETACHED", floor: null }).success,
    ).toBe(true);
  });
  it("상가(EXACT_STRICT)는 floorDisplay=LOW_MID_HIGH를 거부 — 입력 단계에서 차단", () => {
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        buildingType: "STORE",
        floorDisplay: "LOW_MID_HIGH",
        roomCount: null,
        bathCount: null,
      }).success,
    ).toBe(false);
  });
  it("방/욕실은 주거형만 필수 — 상가·사무실은 면제", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, roomCount: null }).success).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        buildingType: "STORE",
        roomCount: null,
        bathCount: null,
        direction: "NE", // 방향은 상가도 필수(주된 출입구 기준)
      }).success,
    ).toBe(true);
  });
  it("방향은 건축물 공통 필수(고시) — 상가도 거부, 토지만 면제", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, direction: null }).success).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        buildingType: "STORE",
        roomCount: null,
        bathCount: null,
        direction: null,
      }).success,
    ).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        buildingType: "LAND",
        floor: null,
        totalFloor: 0,
        roomCount: null,
        bathCount: null,
        direction: null,
      }).success,
    ).toBe(true);
  });
  it("층 교차검증 — 해당층 > 총층, 비단독 총층 0은 공개 거부", () => {
    expect(
      propertySaveSchema.safeParse({ ...validBase, floor: 10, totalFloor: 2 }).success,
    ).toBe(false);
    expect(
      propertySaveSchema.safeParse({ ...validBase, floor: 0, totalFloor: 0 }).success,
    ).toBe(false);
    // 숨김(작성 중)은 여전히 유예
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        listingVisibility: "HIDDEN",
        floor: 10,
        totalFloor: 2,
      }).success,
    ).toBe(true);
  });
  it("관리비 총액이 있는데 3구분 상세가 없으면 공개 거부(§8)", () => {
    expect(
      propertySaveSchema.safeParse({ ...validBase, maintenanceDetail: null }).success,
    ).toBe(false);
    // 관리비 없음(0)은 상세 없이 통과
    expect(
      propertySaveSchema.safeParse({ ...validBase, maintenanceFee: 0, maintenanceDetail: null })
        .success,
    ).toBe(true);
  });
  it("공개 매물의 공통 법정 필수 — 입주일·승인일·주차·용도·관리비", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, moveInDate: null }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, approvalDate: null }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, parkingTotal: null }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, buildingUse: null }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, maintenanceFee: null }).success).toBe(false);
    // 관리비 0(없음)은 유효한 법정 표기다
    expect(propertySaveSchema.safeParse({ ...validBase, maintenanceFee: 0 }).success).toBe(true);
  });
  it("중개보수 안내 문구는 노출 저장 필수 — 숨김은 유예 (A3 카드3)", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, brokerFeeNote: null }).success).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase,
        listingVisibility: "HIDDEN",
        brokerFeeNote: null,
      }).success,
    ).toBe(true);
  });
});
