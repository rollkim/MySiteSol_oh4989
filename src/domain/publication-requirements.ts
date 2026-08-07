import { FLOOR_RULE_BY_BUILDING_TYPE, type BuildingType, type DealType } from "@/lib/codes";

/**
 * 공개(ACTIVE·COMPLETED) 매물의 법정 필수 요건 — 단일 출처.
 *
 * propertySaveSchema(저장 경로)와 updatePropertyStatus(상태 전환 경로)가 **둘 다** 이
 * 함수를 쓴다. 검증이 스키마에만 있으면 "HIDDEN으로 저장 → 상태 버튼으로 ACTIVE 전환"
 * 경로가 법정 검증을 통째로 우회한다(리뷰 확정 critical — 공인중개사법 §18의2).
 *
 * DB 행은 numeric이 string으로 오므로 입력 타입을 느슨하게 받고 null 여부만 본다.
 */

export type PublicationCheckInput = {
  buildingType: BuildingType;
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  /** 가격 협의 — true면 금액 null을 허용한다(A3 카드3). 0원 우회 입력을 막는 장치 */
  priceNegotiable: boolean;
  /** 중개보수 안내 문구 — 법정 필수(A3 카드3) */
  brokerFeeNote: string | null;
  floor: number | null;
  totalFloor: number;
  roomCount: number | null;
  bathCount: number | null;
  direction: string | null;
  moveInDate: string | null;
  approvalDate: string | null;
  parkingTotal: number | null;
  buildingUse: string | null;
  maintenanceFee: number | null;
  maintenanceDetail: unknown;
};

/**
 * 방·욕실 수가 법정 필수인 주거형. 상가·사무실·토지는 면제.
 * ⚠️ 방향(direction)은 여기에 묶이지 않는다 — 고시상 방향은 건축물 공통 항목이라
 * 상가·사무실도 필수다(주된 출입구 기준). 토지만 건축물이 아니라 면제.
 */
export function isResidential(buildingType: BuildingType): boolean {
  return buildingType !== "STORE" && buildingType !== "OFFICE" && buildingType !== "LAND";
}

/** 방향이 법정 필수인 유형 — 건축물 전부(토지만 면제) */
export function requiresDirection(buildingType: BuildingType): boolean {
  return buildingType !== "LAND";
}

export type PublicationIssue = { field: string; message: string };

/** 공개 요건 위반 목록 — 비어 있으면 공개 가능 */
export function checkPublicationRequirements(value: PublicationCheckInput): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  const push = (field: string, message: string) => issues.push({ field, message });

  /* 거래유형별 가격 — '가격 협의'가 켜져 있으면 금액 null을 허용한다(0원 우회 입력 방지) */
  if (!value.priceNegotiable) {
    if (value.dealType === "SALE" && value.salePrice === null) {
      push("salePrice", "공개 매물은 매매가가 필수입니다(협의면 '가격 협의'를 켜세요).");
    }
    if (value.dealType !== "SALE" && value.deposit === null) {
      push("deposit", "공개 매물은 보증금이 필수입니다(협의면 '가격 협의'를 켜세요).");
    }
    if (
      (value.dealType === "MONTHLY" || value.dealType === "SHORT") &&
      value.monthlyRent === null
    ) {
      push("monthlyRent", "공개 매물은 월세가 필수입니다(협의면 '가격 협의'를 켜세요).");
    }
  }

  /* 중개보수 안내 문구 — 법정 필수(A3 카드3) */
  if (value.brokerFeeNote === null || value.brokerFeeNote.trim() === "") {
    push("brokerFeeNote", "중개보수 안내 문구는 법정 필수입니다.");
  }

  /* 층 — 유형별 분기 + 교차 검증 (리뷰: '3/2층'·'총 0층' 공개 차단) */
  const floorRule = FLOOR_RULE_BY_BUILDING_TYPE[value.buildingType];
  if (floorRule !== "TOTAL_ONLY") {
    if (value.floor === null) push("floor", "해당 층을 입력해 주세요.");
    if (value.totalFloor < 1) {
      push("totalFloor", "총 층수는 1 이상이어야 합니다.");
    }
    if (value.floor !== null && value.floor > value.totalFloor) {
      push("floor", "해당 층이 총 층수보다 클 수 없습니다.");
    }
  }

  /* 방향 — 건축물 공통(토지만 면제), 방·욕실 — 주거형만 */
  if (requiresDirection(value.buildingType) && value.direction === null) {
    push("direction", "방향은 법정 필수입니다.");
  }
  if (isResidential(value.buildingType)) {
    if (value.roomCount === null) push("roomCount", "방 수는 법정 필수입니다.");
    if (value.bathCount === null) push("bathCount", "욕실 수는 법정 필수입니다.");
  }

  /* 공통 명시항목 */
  if (value.moveInDate === null) push("moveInDate", "입주가능일은 법정 필수입니다.");
  if (value.approvalDate === null) push("approvalDate", "행정기관 승인일자는 법정 필수입니다.");
  if (value.parkingTotal === null) push("parkingTotal", "주차대수는 법정 필수입니다.");
  if (value.buildingUse === null) push("buildingUse", "건축물 용도는 법정 필수입니다.");

  /* 관리비 — 총액 필수, 총액이 있으면 3구분 상세도 필수(§8: 3구분 + 세부 비목) */
  if (value.maintenanceFee === null) {
    push("maintenanceFee", "관리비는 법정 필수입니다(없으면 0).");
  } else if (value.maintenanceFee > 0 && !hasMaintenanceDetail(value.maintenanceDetail)) {
    push(
      "maintenanceDetail",
      "관리비가 있으면 일반/사용료/기타 3구분 세부 비목을 입력해야 합니다(법정).",
    );
  }

  return issues;
}

function hasMaintenanceDetail(detail: unknown): boolean {
  if (detail === null || typeof detail !== "object") return false;
  return Object.values(detail as Record<string, unknown>).some(
    (rows) => Array.isArray(rows) && rows.length > 0,
  );
}
