import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { inquiries, inquiryLogs, properties } from "@/db/schema";
import { INQUIRY_LOG_ACTIONS, INQUIRY_STATUS } from "@/lib/codes";
import { purgeExpiredContacts } from "@/server/services/inquiry-purge.service";
import { countNewInquiries } from "@/server/services/inquiry.service";

import { adminProcedure, router } from "../init";

const inquiryIdInput = z.object({ inquiryId: z.number().int().positive() });

/**
 * 관리자 문의함 (A4) — 목록·상세·상태·연락 이력.
 * 삭제 기능은 없다(설계원칙 2). 연락처는 보유 기간이 지나면 파기 배치가 지운다.
 */
export const adminInquiryRouter = router({
  /** 좌측 목록 — 탭(전체/신규/연락중/방문예약/완료)은 status 필터로 */
  list: adminProcedure
    .input(z.object({ status: z.enum(INQUIRY_STATUS).optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const [items, [counts]] = await Promise.all([
        ctx.db
          .select({
            id: inquiries.id,
            name: inquiries.name,
            phone: inquiries.phone,
            message: inquiries.message,
            status: inquiries.status,
            inquiryKind: inquiries.inquiryKind,
            interestDong: inquiries.interestDong,
            interestBuildingType: inquiries.interestBuildingType,
            inquirySource: inquiries.inquirySource,
            adminMemo: inquiries.adminMemo,
            contactPurgedAt: inquiries.contactPurgedAt,
            marketingConsentAt: inquiries.marketingConsentAt,
            propertyId: inquiries.propertyId,
            propertyTitle: properties.title,
            createdAt: inquiries.createdAt,
          })
          .from(inquiries)
          .leftJoin(properties, eq(properties.id, inquiries.propertyId))
          .where(input.status ? eq(inquiries.status, input.status) : undefined)
          .orderBy(desc(inquiries.createdAt))
          .limit(200),
        ctx.db
          .select({
            totalCount: sql<number>`count(*)::int`,
            newCount: sql<number>`count(*) filter (where ${inquiries.status} = 'NEW')::int`,
            inProgressCount: sql<number>`count(*) filter (where ${inquiries.status} = 'IN_PROGRESS')::int`,
            visitBookedCount: sql<number>`count(*) filter (where ${inquiries.status} = 'VISIT_BOOKED')::int`,
            doneCount: sql<number>`count(*) filter (where ${inquiries.status} = 'DONE')::int`,
          })
          .from(inquiries),
      ]);
      return { items, counts };
    }),

  /** 우측 상세의 연락 이력 타임라인 */
  logs: adminProcedure.input(inquiryIdInput).query(({ ctx, input }) =>
    ctx.db
      .select({
        id: inquiryLogs.id,
        action: inquiryLogs.action,
        memo: inquiryLogs.memo,
        createdAt: inquiryLogs.createdAt,
      })
      .from(inquiryLogs)
      .where(eq(inquiryLogs.inquiryId, input.inquiryId))
      .orderBy(asc(inquiryLogs.createdAt)),
  ),

  /** 대시보드 KPI·메뉴 배지 — 미처리(NEW) 건수 */
  newCount: adminProcedure.query(({ ctx }) => countNewInquiries(ctx.db)),

  updateStatus: adminProcedure
    .input(inquiryIdInput.extend({ nextStatus: z.enum(INQUIRY_STATUS) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ status: inquiries.status })
          .from(inquiries)
          .where(eq(inquiries.id, input.inquiryId));
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." });
        }
        if (existing.status === input.nextStatus) return;

        await tx
          .update(inquiries)
          .set({ status: input.nextStatus })
          .where(eq(inquiries.id, input.inquiryId));
        // 상태 전환도 이력에 남긴다 — 분쟁 시 "언제 어떻게 처리했는지"가 소명자료
        await tx.insert(inquiryLogs).values({
          inquiryId: input.inquiryId,
          action: "STATUS_CHANGED",
          memo: `${existing.status} → ${input.nextStatus}`,
          adminUserId: ctx.adminUserId,
        });
      });
      return { ok: true as const };
    }),

  /** 연락 이력 추가 (통화 메모·문자 발송 기록) */
  addLog: adminProcedure
    .input(
      inquiryIdInput.extend({
        action: z.enum(INQUIRY_LOG_ACTIONS),
        memo: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [exists] = await ctx.db
        .select({ id: inquiries.id })
        .from(inquiries)
        .where(eq(inquiries.id, input.inquiryId));
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." });

      await ctx.db.insert(inquiryLogs).values({
        inquiryId: input.inquiryId,
        action: input.action,
        memo: input.memo ?? null,
        adminUserId: ctx.adminUserId,
      });
      return { ok: true as const };
    }),

  updateMemo: adminProcedure
    .input(inquiryIdInput.extend({ adminMemo: z.string().trim().max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(inquiries)
        .set({ adminMemo: input.adminMemo === "" ? null : input.adminMemo })
        .where(eq(inquiries.id, input.inquiryId))
        .returning({ id: inquiries.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." });
      return { ok: true as const };
    }),

  /**
   * 연락처 파기 실행 — 스케줄러가 붙기 전까지 관리자가 직접 돌릴 수 있는 경로.
   * 멱등하므로 여러 번 눌러도 안전하다.
   */
  purgeExpiredContacts: adminProcedure.mutation(({ ctx }) => purgeExpiredContacts(ctx.db)),

  /** 파기 대기 건수 — A4 개인정보 보관 카드 표기용 */
  purgeStatus: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        purgedCount: sql<number>`count(*) filter (where ${inquiries.contactPurgedAt} is not null)::int`,
        keptCount: sql<number>`count(*) filter (where ${inquiries.contactPurgedAt} is null)::int`,
      })
      .from(inquiries)
      .where(and(sql`true`));
    return row;
  }),
});
