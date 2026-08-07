/**
 * 확정 디자인(design_handoff_ohchaeyoung_realty)의 브랜드 카피 · 고정 링크 원문.
 * ⚠️ 구어체 카피를 "전문성 있게" 다듬지 않는다 — 의뢰인이 명시적으로 요구한 톤이다(핸드오프 M1 주의).
 * 리스킨 교체 지점: 이 파일 + site_settings(officeInfo) + globals.css @theme 토큰.
 * 법정 표기(상호·주소·등록번호·연락처)는 여기 두지 않는다 — site_settings가 단일 출처다.
 */

/**
 * 브랜드 이미지 자산(/public/brand/*)의 대체 텍스트 — 이미지 파일과 한 몸으로,
 * 리스킨 시 이미지와 함께 교체한다. 법정 표기 렌더는 여전히 officeInfo만 쓴다.
 */
export const WORDMARK_ALT = "Oh! 채영공인중개사무소";
export const PROFILE_ALT = "대표 사진";

/** 모바일 히어로 — 확정안 M1 원문. 배열 원소 = 줄바꿈 */
export const HERO_MOBILE_TITLE_LINES = ["배곧에서 9년.", "될 자리를 압니다."] as const;
export const HERO_MOBILE_SUB_LINES = [
  "28년 장사해본 사람이 보는 상가 자리.",
  "안 될 자리는 안 된다고 말씀드려요.",
] as const;

/** 검색바 placeholder — 확정안 M1 */
export const HERO_SEARCH_PLACEHOLDER = "단지·지역·건물명으로 검색";

/** 헤더 워드마크 아래 한 줄 — 확정안 M1 */
export const HEADER_TAGLINE = "배곧신도시 · 오채영 대표";

/** PC 히어로 — 확정안 PC1(S안). 제목은 [앞, 골드 강조, 뒤] 세 토막 */
export const HERO_PC_EYEBROW = "배곧신도시 상가 전문 · 9년차 · 자영업 28년";
export const HERO_PC_TITLE_PARTS = ["배곧에서 ", "될 자리", "를 찾고 계신가요"] as const;
export const HERO_PC_SUB = "조건만 넣어보세요 · 안 될 자리는 안 된다고 먼저 말씀드립니다";

/** 성과 숫자 3종 — 확정안 pcStats 원문 */
export const HERO_STATS = [
  { statValue: "9년", statLabel: "배곧 한 지역만" },
  { statValue: "28년", statLabel: "자영업 경험" },
  { statValue: "상가 60%", statLabel: "주력 매물" },
] as const;

/** 대표 한마디 — 확정안 PC1 원문(따옴표 포함) */
export const OWNER_QUOTE = "“조건이 애매하면 전화 주세요. 발품은 제가 팝니다.” — 오채영";

/** 대표 신뢰 블록(M1 §5) 카피 */
export const TRUST_TITLE = "직접 보고 찍고 올립니다";
export const TRUST_BODY_LINES = [
  "사진은 전부 제가 현장에서 찍은 것들이에요.",
  "안 될 자리는 안 된다고 먼저 말씀드립니다.",
] as const;

/** 많이 찾는 조건 칩 — 확정안 pcSearchChips 원문 (키워드 검색으로 연결) */
export const POPULAR_SEARCH_KEYWORDS = [
  "무권리 상가",
  "1층 코너",
  "아브뉴프랑",
  "테라스 가능",
  "즉시 입주",
  "서울대 캠퍼스 앞",
] as const;

/** 푸터 브랜드 문구 — 확정안 PC4 비주얼형 원문 */
export const FOOTER_BRAND_TAGLINE = "배곧신도시 상가·오피스텔·아파트 전문";
export const FOOTER_BRAND_LINES = [
  "28년 장사해본 사람이 보는 자리.",
  "안 될 자리는 안 된다고 먼저 말씀드립니다.",
] as const;
export const FOOTER_CALL_NOTE_LINES = ["전화가 가장 빠릅니다.", "못 받으면 문자 남겨주세요."] as const;

/**
 * 공공기관 바로가기 — 확정안 PC4 quickLinks 원문 6종.
 * "계약 전 직접 확인하실 수 있게 모아뒀습니다" — 실제로 연결되는 외부 링크다.
 */
export const PUBLIC_AGENCY_LINKS = [
  { linkName: "인터넷등기소", linkKind: "등기", linkDesc: "등기부등본 열람·발급", linkHost: "iros.go.kr", linkUrl: "https://www.iros.go.kr" },
  { linkName: "정부24", linkKind: "민원", linkDesc: "토지·건축물대장 발급", linkHost: "gov.kr", linkUrl: "https://www.gov.kr" },
  { linkName: "세움터", linkKind: "건축", linkDesc: "건축물대장·허가 이력 조회", linkHost: "eais.go.kr", linkUrl: "https://www.eais.go.kr" },
  { linkName: "토지이음", linkKind: "토지", linkDesc: "용도지역·지구단위계획 확인", linkHost: "eum.go.kr", linkUrl: "https://www.eum.go.kr" },
  { linkName: "실거래가 공개시스템", linkKind: "시세", linkDesc: "국토부 아파트·상가 실거래", linkHost: "rt.molit.go.kr", linkUrl: "https://rt.molit.go.kr" },
  { linkName: "일사편리", linkKind: "종합", linkDesc: "부동산종합증명서 발급", linkHost: "kras.go.kr", linkUrl: "https://kras.go.kr" },
] as const;
