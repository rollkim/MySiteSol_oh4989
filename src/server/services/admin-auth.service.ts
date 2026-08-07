import "server-only";

import bcrypt from "bcryptjs";
import { and, count, eq, gte, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import { adminLoginAttempts, adminUsers } from "@/db/schema";

/**
 * 관리자 로그인 검증 + 브루트포스 차단.
 *
 * 차단 단위는 **(loginId, IP)** — admin_login_attempts 테이블로 판정한다.
 * 이전의 계정 전역 잠금(failedLoginCount/lockedUntil)은 비인증 공격자가 오답 5회로
 * 실제 관리자를 15분씩 무한 차단하는 DoS 벡터라 폐기했다(리뷰 확정 major).
 * 같은 IP에서만 차단되므로 관리자는 자기 자리에서 항상 로그인할 수 있고,
 * 공격자는 IP를 바꿔도 매 IP마다 5회씩만 시도할 수 있다.
 * DB에 두는 이유: 재시작·재배포로 차단이 풀리면 방어가 아니다.
 */

const MAX_FAILED_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

/** 아이디 없음·비밀번호 불일치를 구분하지 않는다 — 계정 존재 여부를 흘리지 않는다 */
export class AdminLoginFailedError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AdminLoginFailedError";
  }
}

export class AdminLoginBlockedError extends Error {
  constructor() {
    super("로그인 실패가 반복되어 잠시 차단됐습니다. 15분 후 다시 시도해 주세요.");
    this.name = "AdminLoginBlockedError";
  }
}

export async function verifyAdminLogin(
  db: Db,
  input: { loginId: string; password: string },
  clientIp: string | null,
): Promise<{ adminUserId: number }> {
  // 시도 전 게이트 — 한도를 넘었으면 비밀번호 비교조차 하지 않는다
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const ipCondition =
    clientIp === null ? isNull(adminLoginAttempts.clientIp) : eq(adminLoginAttempts.clientIp, clientIp);
  const [recentFailures] = await db
    .select({ failureCount: count() })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.loginId, input.loginId),
        ipCondition,
        gte(adminLoginAttempts.createdAt, windowStart),
      ),
    );
  if (recentFailures.failureCount >= MAX_FAILED_PER_WINDOW) {
    throw new AdminLoginBlockedError();
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.loginId, input.loginId));

  const passwordMatches = admin
    ? await bcrypt.compare(input.password, admin.passwordHash)
    : // 존재하지 않는 계정도 같은 시간이 걸리게 더미 비교 — 타이밍으로 계정 존재를 흘리지 않는다
      (await bcrypt.compare(input.password, DUMMY_HASH), false);

  if (!admin || !passwordMatches) {
    await db
      .insert(adminLoginAttempts)
      .values({ loginId: input.loginId, clientIp });
    throw new AdminLoginFailedError();
  }

  // 성공 — 이 (loginId, IP) 조합의 실패 기록을 지워 다음 창을 깨끗하게 시작한다
  await db
    .delete(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.loginId, input.loginId), ipCondition));
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, admin.id));
  return { adminUserId: admin.id };
}

/** 더미 타이밍 비교용 — 유효한 bcrypt 형식이기만 하면 된다(항상 불일치) */
const DUMMY_HASH = "$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZUgxwXG0MRGz5o0YyPEC0S8mDIsB2y";
