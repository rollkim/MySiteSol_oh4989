import { z } from "zod";

import {
  BUILDING_TYPES,
  DEAL_TYPES,
  DIRECTIONS,
  FLOOR_DISPLAY,
  FLOOR_RULE_BY_BUILDING_TYPE,
  MAINTENANCE_GROUPS,
  MAP_PIN_MODES,
  PROPERTY_DEAL_PROGRESS,
  PROPERTY_OPTIONS,
  PROPERTY_VISIBILITY,
} from "@/lib/codes";

import { checkPublicationRequirements } from "./publication-requirements";

// 폼·상세가 이 파일에서 임포트하던 헬퍼 — 소유는 publication-requirements로 이동
export { isResidential, requiresDirection } from "./publication-requirements";

/**
 * 매물 저장 입력 스키마 — 관리자 등록 폼과 admin.property 라우터가 공유한다.
 *
 * "법정 필수항목 누락 시 저장 차단"(SPEC §5)의 구현 지점이다. DB CHECK를 두지 않은
 * 대신 여기서 막는다. 단 **작성 중(숨김) 매물은 느슨하게** 저장을 허용한다 —
 * 노출(VISIBLE) 시점에만 법정 요건을 강제한다. 거래완료도 노출 중이면 동일 강제.
 */

/** 만원 단위 정수 (RULE-11) */
const manwon = z.number().int().min(0);

/** 업로드 라우트가 발급한 경로만 통과 — 임의 경로 주입 차단 */
export const STORED_IMAGE_PATH = /^properties\/\d{6}\/[a-f0-9]{24}\.jpg$/;
export const STORED_THUMB_PATH = /^properties\/\d{6}\/[a-f0-9]{24}-thumb\.jpg$/;

const imageInput = z.object({
  id: z.number().int().positive().optional(), // 있으면 기존 행 유지, 없으면 신규
  filePath: z.string().regex(STORED_IMAGE_PATH, "잘못된 이미지 경로입니다."),
  thumbPath: z.string().regex(STORED_THUMB_PATH, "잘못된 썸네일 경로입니다."),
});

/** properties.maintenanceDetail(jsonb) 형태 — codes.ts의 MaintenanceDetail과 동형 */
const maintenanceDetailInput = z.record(
  z.enum(MAINTENANCE_GROUPS),
  z.array(z.object({ item: z.string().trim().min(1).max(30), amount: manwon })),
);

/** "2026-13-40" 같은 무효 날짜가 DB 오류(500)로 터지지 않게 실제 달력 검증까지 한다 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식입니다.")
  .refine((dateText) => {
    const parsed = new Date(`${dateText}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateText;
  }, "존재하지 않는 날짜입니다.");

export const propertySaveSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력해 주세요.").max(100),
    buildingType: z.enum(BUILDING_TYPES),
    dealType: z.enum(DEAL_TYPES),
    /* 노출·거래 진행 2축 (A3 카드2) — 구 status(ACTIVE/COMPLETED/HIDDEN) 대체 */
    listingVisibility: z.enum(PROPERTY_VISIBILITY),
    dealProgress: z.enum(PROPERTY_DEAL_PROGRESS),
    /** 진열 순서 (A3 카드2 스테퍼) — 확정 범위 -10 ~ 999 */
    displayOrder: z.number().int().min(-10).max(999),

    salePrice: manwon.nullable(),
    deposit: manwon.nullable(),
    monthlyRent: manwon.nullable(),
    priceNegotiable: z.boolean(),
    /** 중개보수 안내 문구 — 공개 저장 필수는 publication-requirements가 강제 */
    brokerFeeNote: z.string().trim().min(1).max(200).nullable(),

    // numeric 컬럼이지만 입력은 number로 받고 서비스에서 string 변환
    exclusiveArea: z.number().positive().multipleOf(0.1),
    supplyArea: z.number().positive().multipleOf(0.1).nullable(),

    floor: z.number().int().min(-9).max(200).nullable(),
    totalFloor: z.number().int().min(0).max(200),
    floorDisplay: z.enum(FLOOR_DISPLAY),

    roomCount: z.number().int().min(0).max(50).nullable(),
    bathCount: z.number().int().min(0).max(50).nullable(),
    direction: z.enum(DIRECTIONS).nullable(),
    directionBase: z.string().trim().max(20).nullable(),
    moveInDate: z.string().trim().min(1).max(20).nullable(),
    approvalDate: calendarDate.nullable(),
    parkingTotal: z.number().int().min(0).max(10000).nullable(),
    parkingPerUnit: z.number().min(0).max(99).nullable(),
    buildingUse: z.string().trim().min(1).max(50).nullable(),

    maintenanceFee: manwon.nullable(),
    maintenanceDetail: maintenanceDetailInput.nullable(),

    /** 상가·사무실 전용 — 선택 입력(법정 필수 아님). 권리금 0 = "없음" 표기 */
    premiumFee: manwon.nullable(),
    businessTypeCurrent: z.string().trim().max(30).nullable(),
    businessTypeRecommended: z.string().trim().max(60).nullable(),

    sido: z.string().trim().min(1).max(20),
    sigungu: z.string().trim().min(1).max(30),
    dong: z.string().trim().min(1).max(30),
    bjdCode: z.string().regex(/^\d{10}$/, "법정동코드는 숫자 10자리입니다."),
    jibunAddress: z.string().trim().min(1).max(200),
    roadAddress: z.string().trim().max(200).nullable(),
    /** ⚠️ 공개 응답에는 절대 실리지 않는다(RULE-11) — 입력만 받는다 */
    detailAddress: z.string().trim().max(100).nullable(),

    lat: z.number().min(33).max(39), // 한국 위경도 범위 밖이면 입력 실수
    lng: z.number().min(124).max(132),
    /** 지도 핀 표시 방식 (A3 카드6) — 좌표는 항상 실제 값, 응답만 치환 */
    mapPinMode: z.enum(MAP_PIN_MODES),
    /** 네이버 매물번호 — 수기 메모(자동 조회는 보류, 2026-08-07 결정) */
    naverListingNo: z.string().trim().max(20).nullable(),

    description: z.string().max(5000),
    videoUrl: z.url("올바른 URL이 아닙니다.").max(300).nullable(),
    videoDuration: z.string().trim().max(10).nullable(),
    videoSummary: z.string().trim().max(100).nullable(),
    fieldCheckedAt: calendarDate.nullable(),

    optionCodes: z.array(z.enum(PROPERTY_OPTIONS)).max(PROPERTY_OPTIONS.length),
    images: z.array(imageInput).max(20),
  })
  .superRefine((value, ctx) => {
    // 상가·사무실은 상태와 무관하게 저/중/고 대체가 불법 — 항상 차단
    const floorRule = FLOOR_RULE_BY_BUILDING_TYPE[value.buildingType];
    if (floorRule === "EXACT_STRICT" && value.floorDisplay === "LOW_MID_HIGH") {
      ctx.addIssue({
        code: "custom",
        path: ["floorDisplay"],
        message: "상가·사무실은 저/중/고 표기로 대체할 수 없습니다(법정).",
      });
    }

    if (value.listingVisibility === "HIDDEN") return; // 작성 중 — 법정 필수 검증 유예

    /* 노출(VISIBLE) 법정 요건 — 노출 전환 경로(서비스)와 같은 함수를 쓴다.
       여기서만 검사하면 "숨김 저장 후 노출 버튼 전환"이 우회한다 */
    for (const issue of checkPublicationRequirements(value)) {
      ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
    }
  });

export type PropertySaveInput = z.infer<typeof propertySaveSchema>;
