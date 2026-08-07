import {
  FLOOR_RULE_BY_BUILDING_TYPE,
  type BuildingType,
  type FloorDisplay,
} from "@/lib/codes";

/**
 * 층 표기 (공인중개사법 제18조의2, 디자인가이드 §8).
 * 상세 화면·목록 카드·관리자 미리보기가 전부 이 함수를 거친다.
 * 분기 규칙 자체는 codes.ts의 FLOOR_RULE_BY_BUILDING_TYPE이 단일 출처다.
 */

export type FloorFormatInput = {
  buildingType: BuildingType;
  floor: number | null;
  totalFloor: number;
  floorDisplay: FloorDisplay;
};

/** 해당층의 저/중/고 밴드 — 총층 3등분, 경계 올림. 지하·반지하는 항상 저 */
export function floorBand(floor: number, totalFloor: number): "저" | "중" | "고" {
  if (floor <= 0) return "저";
  const bandSize = Math.ceil(totalFloor / 3);
  if (floor <= bandSize) return "저";
  if (floor <= bandSize * 2) return "중";
  return "고";
}

/** 지하 음수 층 → "B1" */
function formatFloorNumber(floor: number): string {
  return floor < 0 ? `B${-floor}` : String(floor);
}

export function formatFloor(input: FloorFormatInput): string {
  if (input.totalFloor === 0) return "-"; // 토지 — 층 개념 없음
  const rule = FLOOR_RULE_BY_BUILDING_TYPE[input.buildingType];
  if (rule === "TOTAL_ONLY" || input.floor === null) return `총 ${input.totalFloor}층`;
  if (rule === "EXACT" && input.floorDisplay === "LOW_MID_HIGH") {
    return `${floorBand(input.floor, input.totalFloor)}/${input.totalFloor}층`;
  }
  // EXACT_STRICT는 floorDisplay 값과 무관하게 정확 표기 — 저/중/고 대체 불가(법정)
  return `${formatFloorNumber(input.floor)}/${input.totalFloor}층`;
}
