import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ownerRequests } from "@/db/schema";
import { OWNER_REQUEST_STATUS } from "@/lib/codes";

import { adminProcedure, router } from "../init";

const ownerRequestIdInput = z.object({ ownerRequestId: z.number().int().positive() });

/** 관리자 등록의뢰함 — 목록·상태(신규→연락함→매물 등록됨/반려)·메모 */
export const adminOwnerRequestRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.select().from(ownerRequests).orderBy(desc(ownerRequests.createdAt)).limit(200),
  ),

  updateStatus: adminProcedure
    .input(ownerRequestIdInput.extend({ nextStatus: z.enum(OWNER_REQUEST_STATUS) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(ownerRequests)
        .set({ status: input.nextStatus })
        .where(eq(ownerRequests.id, input.ownerRequestId))
        .returning({ id: ownerRequests.id });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "의뢰를 찾을 수 없습니다." });
      }
      return { ok: true as const };
    }),

  updateMemo: adminProcedure
    .input(ownerRequestIdInput.extend({ adminMemo: z.string().trim().max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(ownerRequests)
        .set({ adminMemo: input.adminMemo === "" ? null : input.adminMemo })
        .where(eq(ownerRequests.id, input.ownerRequestId))
        .returning({ id: ownerRequests.id });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "의뢰를 찾을 수 없습니다." });
      }
      return { ok: true as const };
    }),
});
