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
 * 건물유형 그룹 칩 — 목록(M2)과 지도(M3/PC2)가 같은 그룹으로 필터를 주고받는다
 * (확정안 "목록 ↔ 지도 토글: 같은 검색 조건 유지"). 코드값이 아닌 UI 그룹이지만
 * 두 화면이 갈라지면 토글 시 조건이 어긋나므로 단일 출처로 여기 둔다.
 */
export const BUILDING_GROUP_CHIPS: { label: string; types: BuildingType[] }[] = [
  { label: "상가", types: ["STORE"] },
  { label: "아파트·오피스텔", types: ["APT", "OFFICETEL"] },
  { label: "사무실", types: ["OFFICE"] },
];

/* ─────────────── 문의 유형 (확정안 M5 칩 3종) ─────────────── */

export const INQUIRY_KINDS = ["FIND", "LISTING", "ETC"] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];
export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  FIND: "매물 찾기",
  LISTING: "매물 내놓기",
  ETC: "기타 문의",
};

/* ─────────────── 목록 정렬 (확정안 M2) ─────────────── */

export const PROPERTY_LIST_SORTS = ["LATEST", "PRICE_ASC", "AREA_DESC"] as const;
export type PropertyListSort = (typeof PROPERTY_LIST_SORTS)[number];
export const PROPERTY_LIST_SORT_LABEL: Record<PropertyListSort, string> = {
  LATEST: "최신순",
  PRICE_ASC: "가격 낮은순",
  AREA_DESC: "면적 넓은순",
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

/* ─────────────── 매물 노출 / 거래 진행 (관리자 A3 카드2) ───────────────
   기존 PROPERTY_STATUS(ACTIVE·COMPLETED·HIDDEN) 단일 축을 두 축으로 분해했다.
   확정 기획이 '홈페이지 노출'과 '거래 진행 상태'를 별도 라디오그룹으로 두고,
   '계약중'은 단일 축에 자리가 없어 저장 자체가 불가능했던 값이다. */

export const PROPERTY_VISIBILITY = ["VISIBLE", "HIDDEN"] as const;
export type PropertyVisibility = (typeof PROPERTY_VISIBILITY)[number];

export const PROPERTY_VISIBILITY_LABEL: Record<PropertyVisibility, string> = {
  VISIBLE: "노출",
  HIDDEN: "숨김",
};

/** 거래 진행 — AVAILABLE=거래중(기본). ON_SALE로 하지 않은 이유: 매매 전용처럼 읽힌다 */
export const PROPERTY_DEAL_PROGRESS = ["AVAILABLE", "UNDER_CONTRACT", "COMPLETED"] as const;
export type PropertyDealProgress = (typeof PROPERTY_DEAL_PROGRESS)[number];

export const PROPERTY_DEAL_PROGRESS_LABEL: Record<PropertyDealProgress, string> = {
  AVAILABLE: "거래중",
  UNDER_CONTRACT: "계약중",
  COMPLETED: "거래완료",
};

/** 지도 핀 표시 방식 (A3 카드6) — DONG_CENTER는 실제 좌표를 보존한 채 응답만 치환한다 */
export const MAP_PIN_MODES = ["EXACT", "DONG_CENTER"] as const;
export type MapPinMode = (typeof MAP_PIN_MODES)[number];

export const MAP_PIN_MODE_LABEL: Record<MapPinMode, string> = {
  EXACT: "지도에 실제 위치 표시",
  DONG_CENTER: "동 중심으로만",
};

/** 층 표기 방식 — 저/중/고 대체 여부 */
export const FLOOR_DISPLAY = ["EXACT", "LOW_MID_HIGH"] as const;
export type FloorDisplay = (typeof FLOOR_DISPLAY)[number];

/* ─────────────── 문의 / 등록의뢰 상태 ───────────────
   SPEC §3에 컬럼만 있고 값 정의가 빠져 있어 여기서 확정한다. */

/* varchar(20) 컬럼이라 값 추가에 마이그레이션이 필요 없다.
   기획 A4 처리 상태 칩 4종(신규/연락중/방문 예약/완료)에 맞춘다. SPAM은 운영상 유지 */
export const INQUIRY_STATUS = ["NEW", "IN_PROGRESS", "VISIT_BOOKED", "DONE", "SPAM"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUS)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: "신규",
  IN_PROGRESS: "연락중",
  VISIT_BOOKED: "방문 예약",
  DONE: "완료",
  SPAM: "스팸",
};

/** 문의 접수 경로 (A4 헤더) — 진입점이 여럿이라 propertyId 유무로는 구분되지 않는다 */
export const INQUIRY_SOURCES = [
  "HOME_FORM",
  "PROPERTY_DETAIL",
  "MAP_SHEET",
  "LIST",
  "ETC",
] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  HOME_FORM: "홈 상담 폼",
  PROPERTY_DETAIL: "매물 상세",
  MAP_SHEET: "지도 시트",
  LIST: "매물 목록",
  ETC: "기타",
};

/** 문의 연락 이력 액션 (A4 타임라인) — 분쟁 시 "언제 무슨 연락을 했는지"가 소명자료다 */
export const INQUIRY_LOG_ACTIONS = [
  "RECEIVED",
  "AUTO_REPLY",
  "SMS_SENT",
  "CALL_MEMO",
  "STATUS_CHANGED",
] as const;
export type InquiryLogAction = (typeof INQUIRY_LOG_ACTIONS)[number];

export const INQUIRY_LOG_ACTION_LABEL: Record<InquiryLogAction, string> = {
  RECEIVED: "문의 접수",
  AUTO_REPLY: "자동 회신",
  SMS_SENT: "문자 발송",
  CALL_MEMO: "통화 메모",
  STATUS_CHANGED: "상태 변경",
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
  /** @deprecated 2축 분해 전 기록 — **삭제 금지**: 기존 로그 행이 이 값을 갖고 있다 */
  "STATUS_CHANGED",
  "VISIBILITY_CHANGED",
  "DEAL_PROGRESS_CHANGED",
  "ARCHIVED",
  "UNARCHIVED",
  "DELETED",
  "RESTORED",
] as const;
export type PropertyLogAction = (typeof PROPERTY_LOG_ACTIONS)[number];

/* ─────────────── 관리자 권한 ─────────────── */

/** README §권한 — 지금은 OWNER 1계정 운영, ASSISTANT는 라우트 가드 자리만 */
export const ADMIN_ROLES = ["OWNER", "ASSISTANT"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "대표",
  ASSISTANT: "보조",
};

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
