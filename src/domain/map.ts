/**
 * 지도 검색 규칙 (SPEC §4 mapSearch) — 서버 라우터와 지도 화면(Phase 2)이 공유한다.
 * 값을 화면·서버가 따로 가지면 "줌 13인데 마커가 왔다/집계가 왔다"가 어긋난다.
 */

/** 이 줌 미만은 동 단위 집계로 응답한다. 네이버 지도 줌 체계(6~21) 기준 동 경계가 읽히는 수준 */
export const MAP_MARKER_MIN_ZOOM = 14;

/** 개별 마커 응답 상한 — 초과분은 자르고 truncated 신호를 보낸다("더 확대" 안내용) */
export const MAP_MARKER_LIMIT = 200;

/** 키워드 검색 최대 길이 — 서버 zod 스키마·화면 입력·딥링크가 같은 값을 본다 */
export const MAP_KEYWORD_MAX_LENGTH = 50;

/**
 * LIKE/ILIKE 패턴 이스케이프 — 사용자 키워드의 %·_가 와일드카드로 해석되면
 * '_' 한 글자로 전체 매칭 같은 왜곡이 생긴다. PostgreSQL 기본 이스케이프 문자 \ 사용.
 */
export function escapeLikePattern(rawKeyword: string): string {
  return rawKeyword.replace(/[\\%_]/g, "\\$&");
}

/**
 * 초기 지도 중심 — 배곧신도시(사무소 상권). SPEC §10 블로커 표의 "추정값으로 시작 가능".
 * 리스킨 시 site_settings로 옮길 후보지만, 값이 확정되기 전까지는 여기가 단일 출처다.
 */
export const MAP_INITIAL_CENTER = { lat: 37.3799, lng: 126.7291 };
export const MAP_INITIAL_ZOOM = 15;

/** 지역 바로가기·검색 매칭 사전 — 서비스 상권(시흥 배곧 일대) */
export const MAP_REGIONS = [
  { label: "배곧동", lat: 37.3799, lng: 126.7291 },
  { label: "정왕동", lat: 37.3454, lng: 126.7413 },
  { label: "월곶동", lat: 37.3893, lng: 126.7418 },
] as const;

/**
 * 공개 좌표 — mapPinMode가 DONG_CENTER면 실좌표 대신 동 중심을 내보낸다(관리자 A3 카드6).
 * 실좌표는 DB에 보존되고 응답만 치환한다. 사전에 없는 동은 ~500m 격자로 뭉개서
 * "동 중심으로만"의 의도(정확 위치 비노출)가 조용히 깨지지 않게 한다.
 */
export function publicCoordinate(
  dong: string,
  lat: number,
  lng: number,
  mapPinMode: "EXACT" | "DONG_CENTER",
): { lat: number; lng: number } {
  if (mapPinMode === "EXACT") return { lat, lng };
  const region = MAP_REGIONS.find((candidate) => candidate.label === dong);
  if (region) return { lat: region.lat, lng: region.lng };
  return { lat: Math.round(lat * 200) / 200, lng: Math.round(lng * 200) / 200 };
}
