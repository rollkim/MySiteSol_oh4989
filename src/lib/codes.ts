/**
 * 코드값 단일 출처 — DB·서버·화면이 **전부 이 파일만 참조한다.**
 *
 * DB ENUM을 쓰지 않는 이유(SPEC §3): PostgreSQL에서 ENUM에 값을 추가하려면 ALTER TYPE이
 * 필요하고, 값을 빼거나 순서를 바꾸는 건 사실상 불가능하다. 매물 유형·옵션은 앞으로 늘어난다.
 * varchar + 여기의 `as const`로 관리하면 타입 안전성은 그대로 두고 마이그레이션 없이 늘릴 수 있다.
 *
 * 규약(RULE-11): 코드값은 영문 대문자 SNAKE_CASE, 한글은 화면 표시용 label에만 둔다.
 */

/* ─────────────── 거래유형 ─────────────── */

export const DEAL_TYPES = ["SALE", "JEONSE", "MONTHLY", "SHORT"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  SALE: "매매",
  JEONSE: "전세",
  MONTHLY: "월세",
  SHORT: "단기임대",
};

/* ─────────────── 건물유형 ─────────────── */

export const BUILDING_TYPES = [
  "APT", // 아파트
  "OFFICETEL", // 오피스텔
  "VILLA", // 빌라·다세대
  "ONE_ROOM", // 원룸
  "TWO_ROOM", // 투룸
  "URBAN", // 도시형생활주택
  "DETACHED", // 단독·다가구
  "STORE", // 상가
  "OFFICE", // 사무실
  "LAND", // 토지
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  APT: "아파트",
  OFFICETEL: "오피스텔",
  VILLA: "빌라·다세대",
  ONE_ROOM: "원룸",
  TWO_ROOM: "투룸",
  URBAN: "도시형생활주택",
  DETACHED: "단독·다가구",
  STORE: "상가",
  OFFICE: "사무실",
  LAND: "토지",
};

/**
 * 층 표기 규칙 (디자인가이드 §8 / 공인중개사법 제18조의2).
 * 화면과 관리자 등록 폼이 **둘 다** 이 분기를 따라야 한다.
 *
 * - `TOTAL_ONLY`   단독주택: 총 층수만 표기 (예: `총 2층`)
 * - `EXACT`        그 외 주택: `해당층/총층`. 의뢰인이 원하면 저/중/고로 대체 가능
 * - `EXACT_STRICT` 상가·근린생활시설: `해당층/총층` 고정. **저/중/고 대체 불가**
 */
export const FLOOR_RULE_BY_BUILDING_TYPE: Record<
  BuildingType,
  "TOTAL_ONLY" | "EXACT" | "EXACT_STRICT"
> = {
  APT: "EXACT",
  OFFICETEL: "EXACT",
  VILLA: "EXACT",
  ONE_ROOM: "EXACT",
  TWO_ROOM: "EXACT",
  URBAN: "EXACT",
  DETACHED: "TOTAL_ONLY",
  STORE: "EXACT_STRICT",
  OFFICE: "EXACT_STRICT",
  LAND: "TOTAL_ONLY",
};

/* ─────────────── 방향 ─────────────── */

export const DIRECTIONS = ["E", "W", "S", "N", "SE", "SW", "NE", "NW"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABEL: Record<Direction, string> = {
  E: "동향",
  W: "서향",
  S: "남향",
  N: "북향",
  SE: "남동향",
  SW: "남서향",
  NE: "북동향",
  NW: "북서향",
};

/* ─────────────── 매물 상태 ─────────────── */

export const PROPERTY_STATUS = ["ACTIVE", "COMPLETED", "HIDDEN"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUS)[number];

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  ACTIVE: "거래중",
  COMPLETED: "거래완료",
  HIDDEN: "숨김",
};

/** 층 표기 방식 — 저/중/고 대체 여부 */
export const FLOOR_DISPLAY = ["EXACT", "LOW_MID_HIGH"] as const;
export type FloorDisplay = (typeof FLOOR_DISPLAY)[number];

/* ─────────────── 문의 / 등록의뢰 상태 ───────────────
   SPEC §3에 컬럼만 있고 값 정의가 빠져 있어 여기서 확정한다. */

export const INQUIRY_STATUS = ["NEW", "IN_PROGRESS", "DONE", "SPAM"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUS)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: "신규",
  IN_PROGRESS: "처리중",
  DONE: "처리완료",
  SPAM: "스팸",
};

export const OWNER_REQUEST_STATUS = [
  "NEW",
  "CONTACTED",
  "REGISTERED",
  "DECLINED",
] as const;
export type OwnerRequestStatus = (typeof OWNER_REQUEST_STATUS)[number];

export const OWNER_REQUEST_STATUS_LABEL: Record<OwnerRequestStatus, string> = {
  NEW: "신규",
  CONTACTED: "연락함",
  REGISTERED: "매물 등록됨",
  DECLINED: "반려",
};

/* ─────────────── 매물 변경 이력 액션 ───────────────
   거래완료 방치 과태료의 소명자료라 무엇이 언제 바뀌었는지 남긴다 (RULE-11). */

export const PROPERTY_LOG_ACTIONS = [
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
  "DELETED",
  "RESTORED",
] as const;
export type PropertyLogAction = (typeof PROPERTY_LOG_ACTIONS)[number];

/* ─────────────── 옵션 ───────────────
   디자인가이드 §6의 "필터 상세 시트 - 옵션 체크"에 그대로 대응한다. */

export const PROPERTY_OPTIONS = [
  "AIRCON",
  "FRIDGE",
  "WASHER",
  "BUILT_IN_CLOSET",
  "GAS_RANGE",
  "INDUCTION",
  "MICROWAVE",
  "DESK",
  "BED",
  "TV",
  "SHOE_CLOSET",
  "BIDET",
  "DOOR_LOCK",
  "ELEVATOR",
  "PARKING",
  "CCTV",
  "INTERCOM",
  "FIRE_ALARM",
  "VERANDA",
  "PET_ALLOWED",
  "LOFT",
] as const;
export type PropertyOption = (typeof PROPERTY_OPTIONS)[number];

export const PROPERTY_OPTION_LABEL: Record<PropertyOption, string> = {
  AIRCON: "에어컨",
  FRIDGE: "냉장고",
  WASHER: "세탁기",
  BUILT_IN_CLOSET: "붙박이장",
  GAS_RANGE: "가스레인지",
  INDUCTION: "인덕션",
  MICROWAVE: "전자레인지",
  DESK: "책상",
  BED: "침대",
  TV: "TV",
  SHOE_CLOSET: "신발장",
  BIDET: "비데",
  DOOR_LOCK: "도어락",
  ELEVATOR: "엘리베이터",
  PARKING: "주차가능",
  CCTV: "CCTV",
  INTERCOM: "인터폰",
  FIRE_ALARM: "화재경보기",
  VERANDA: "베란다",
  PET_ALLOWED: "반려동물",
  LOFT: "복층",
};

/* ─────────────── 관리비 구분 ───────────────
   공인중개사법상 관리비는 일반관리비 / 사용료 / 기타관리비 3구분이 의무다 (디자인가이드 §8).
   properties.maintenanceDetail(jsonb)의 최상위 키가 이 값들이다. */

export const MAINTENANCE_GROUPS = ["GENERAL", "USAGE", "ETC"] as const;
export type MaintenanceGroup = (typeof MAINTENANCE_GROUPS)[number];

export const MAINTENANCE_GROUP_LABEL: Record<MaintenanceGroup, string> = {
  GENERAL: "일반관리비",
  USAGE: "사용료",
  ETC: "기타관리비",
};

/** properties.maintenanceDetail 의 형태 — 금액은 만원 단위 정수 (RULE-11) */
export type MaintenanceDetail = Record<
  MaintenanceGroup,
  { item: string; amount: number }[]
>;
