import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

/**
 * 관리자 세션 — jose HS256 서명 쿠키. DB 세션 테이블을 두지 않는다(1~2계정 규모,
 * 강제 로그아웃이 필요한 운영 시나리오가 없다).
 *
 * 이 사이트는 비회원 전용이라 세션 주체가 관리자 하나뿐이지만, PaRaSOL의
 * aud 클레임(=admin)은 유지한다 — 비용이 0이고 토큰의 용도를 자기서술하게 만든다.
 * 수명 8시간: 근무 단위. 관리 화면은 권한이 크고 공용 PC에서 열릴 수 있다.
 */

export const ADMIN_SESSION_COOKIE_NAME = "oh4989_admin";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const ADMIN_TOKEN_AUDIENCE = "admin";

function getSessionSecretKey(): Uint8Array {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET 환경변수가 없거나 32자 미만입니다. .env에 32자 이상 랜덤 문자열을 설정하세요.",
    );
  }
  return new TextEncoder().encode(sessionSecret);
}

/** 로그인 성공 시 세션 쿠키 발급 */
export async function issueAdminSessionCookie(adminUserId: number): Promise<void> {
  const sessionJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminUserId))
    .setAudience(ADMIN_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, sessionJwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", // tRPC(/api/trpc)·업로드(/api/admin)가 함께 쓴다
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

function readCookieValueFromHeader(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      // 무효 %-시퀀스가 담긴 쿠키로 요청 전체가 500이 되지 않게 — 못 읽으면 비로그인 취급
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * 세션에서 adminUserId 해석. 위조·만료는 전부 null.
 * cookieHeader를 주면 그것만 보고(tRPC 컨텍스트·라우트 핸들러),
 * 안 주면 next/headers의 cookies()를 읽는다(서버 컴포넌트).
 */
export async function readAdminSessionUserId(
  cookieHeader?: string | null,
): Promise<number | null> {
  let sessionJwt: string | null;
  if (cookieHeader === undefined) {
    const cookieStore = await cookies();
    sessionJwt = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  } else {
    sessionJwt = cookieHeader
      ? readCookieValueFromHeader(cookieHeader, ADMIN_SESSION_COOKIE_NAME)
      : null;
  }
  if (!sessionJwt) return null;

  try {
    const { payload } = await jwtVerify(sessionJwt, getSessionSecretKey(), {
      algorithms: ["HS256"],
      audience: ADMIN_TOKEN_AUDIENCE,
    });
    const parsedAdminUserId = Number(payload.sub);
    if (!Number.isInteger(parsedAdminUserId) || parsedAdminUserId <= 0) return null;
    return parsedAdminUserId;
  } catch {
    return null;
  }
}

/** 로그아웃 — 같은 속성으로 덮어써야 브라우저가 확실히 지운다 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
