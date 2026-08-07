import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { adminUsers } from "@/db/schema";
import {
  clearAdminSessionCookie,
  issueAdminSessionCookie,
} from "@/server/auth/admin-session";
import {
  AdminLoginBlockedError,
  AdminLoginFailedError,
  verifyAdminLogin,
} from "@/server/services/admin-auth.service";

import { adminProcedure, publicProcedure, router } from "../init";

/** 관리자 인증 — login만 public(아직 세션이 없다), 나머지는 admin */
export const adminAuthRouter = router({
  /** 관리자 셸이 부른다 — 비로그인이면 null(로그인 화면으로) */
  getSession: publicProcedure.query(({ ctx }) =>
    ctx.adminUserId === null ? null : { adminUserId: ctx.adminUserId },
  ),

  login: publicProcedure
    .input(
      z.object({
        loginId: z.string().trim().min(1, "아이디를 입력해 주세요.").max(40),
        password: z.string().min(1, "비밀번호를 입력해 주세요.").max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { adminUserId } = await verifyAdminLogin(ctx.db, input, ctx.clientIp);
        await issueAdminSessionCookie(adminUserId);
        return { ok: true as const };
      } catch (loginError) {
        if (loginError instanceof AdminLoginBlockedError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: loginError.message });
        }
        if (loginError instanceof AdminLoginFailedError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: loginError.message });
        }
        throw loginError;
      }
    }),

  /** 사이드바 하단 프로필 표시용 — displayName이 없으면 loginId를 그대로 보여준다 */
  me: adminProcedure.query(async ({ ctx }) => {
    const [adminUser] = await ctx.db
      .select({
        loginId: adminUsers.loginId,
        displayName: adminUsers.displayName,
        adminRole: adminUsers.adminRole,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, ctx.adminUserId));
    if (!adminUser) throw new TRPCError({ code: "UNAUTHORIZED" });
    return adminUser;
  }),

  logout: adminProcedure.mutation(async () => {
    await clearAdminSessionCookie();
    return { ok: true as const };
  }),
});
