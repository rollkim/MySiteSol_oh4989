import "server-only";

import { db } from "@/db";

/**
 * 프록시 뒤 실제 클라이언트 IP — 문의 레이트리밋(SPEC §4: IP당 시간당 5회)의 키가 된다.
 *
 * 프로시저가 next/headers의 headers()를 직접 부르면 요청 스코프 밖(서버 컴포넌트 caller·
 * 배치 스크립트)에서 throw한다. 요청 정보는 컨텍스트가 소유한다.
 */
function readClientIp(requestHeaders: Headers): string | null {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : null;
}

/**
 * 요청마다 생성되는 tRPC 컨텍스트 — 모든 프로시저가 공유한다.
 *
 * 이 사이트는 **비회원 전용**이라 고객 세션이라는 개념이 없다. 인증 주체는 관리자 하나뿐이다.
 * `adminUserId`는 Phase 1에서 관리자 로그인이 붙기 전까지 항상 null이고,
 * 그동안 adminProcedure는 모든 호출을 거부한다 —
 * 열어두고 나중에 닫는 것보다 닫아두고 나중에 여는 쪽이 안전하다.
 *
 * `db`는 전역 풀을 재사용한다. 여기 담기는 것만으로는 접속하지 않는다(첫 쿼리에서 연결).
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  return {
    db,
    adminUserId: null as number | null,
    clientIp: readClientIp(opts.headers),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
