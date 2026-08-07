import "server-only";

import { db } from "@/db";
import { readAdminSessionUserId } from "@/server/auth/admin-session";

/**
 * 프록시 뒤 실제 클라이언트 IP — 문의 레이트리밋(SPEC §4: IP당 시간당 5회)의 키가 된다.
 *
 * **마지막 항목을 신뢰한다.** 우리 nginx는 `proxy_add_x_forwarded_for`(append)라서
 * 클라이언트가 헤더를 위조해 보내면 `위조IP, 실제IP` 형태가 된다 — 첫 항목을 믿으면
 * 요청마다 다른 위조 IP로 레이트리밋이 전면 무력화된다(리뷰 확정 major).
 * 마지막 항목은 항상 우리 nginx가 붙인 실제 접속 IP다.
 *
 * 프로시저가 next/headers의 headers()를 직접 부르면 요청 스코프 밖(서버 컴포넌트 caller·
 * 배치 스크립트)에서 throw한다. 요청 정보는 컨텍스트가 소유한다.
 */
function readClientIp(requestHeaders: Headers): string | null {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const parts = forwardedFor.split(",");
  return parts[parts.length - 1].trim() || null;
}

/**
 * 요청마다 생성되는 tRPC 컨텍스트 — 모든 프로시저가 공유한다.
 *
 * 이 사이트는 **비회원 전용**이라 고객 세션이라는 개념이 없다. 인증 주체는 관리자 하나뿐이다.
 * `adminUserId`는 oh4989_admin 쿠키(jose 서명)를 판독해 채운다 — 위조·만료·부재는 null이고
 * adminProcedure가 거부한다. DB 재확인은 하지 않는다: 계정 비활성화 기능이 없어
 * 토큰 서명 검증만으로 충분하다(잠금은 로그인 시점에만 판정).
 *
 * `db`는 전역 풀을 재사용한다. 여기 담기는 것만으로는 접속하지 않는다(첫 쿼리에서 연결).
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  return {
    db,
    adminUserId: await readAdminSessionUserId(opts.headers.get("cookie")),
    clientIp: readClientIp(opts.headers),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
