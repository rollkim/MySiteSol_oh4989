import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { inquiries, inquiryLogs, ownerRequests, siteSettings } from "@/db/schema";

/**
 * 문의·등록 의뢰 **연락처 자동 파기** — 개인정보처리방침에 공표한 약속의 이행부다.
 * "접수일로부터 3개월 후 연락처 자동 파기 · 통계와 이력은 남습니다"(/privacy §2).
 *
 * 이름·연락처만 NULL로 지우고 행은 남긴다 — 문의 건수·처리 이력·연락 타임라인은
 * 개인 식별정보 없이 유지되어야 통계와 분쟁 소명이 가능하다(개인정보보호법 §21).
 * 파기 시각(contactPurgedAt)을 남겨 "파기됨"과 "원래 미기재"를 구분하고 배치를 멱등하게 만든다.
 *
 * 보유 기간은 site_settings.inquiryRetention이 단일 출처 — 방침 페이지 문구와 같은 값을 봐야 한다.
 */

const DEFAULT_RETENTION_MONTHS = 3;

async function readRetentionMonths(db: Db): Promise<number> {
  const [row] = await db
    .select({ settingValue: siteSettings.settingValue })
    .from(siteSettings)
    .where(sql`${siteSettings.settingKey} = 'inquiryRetention'`);
  const months = (row?.settingValue as { months?: number } | undefined)?.months;
  return typeof months === "number" && months > 0 ? months : DEFAULT_RETENTION_MONTHS;
}

export type PurgeResult = {
  retentionMonths: number;
  purgedInquiryCount: number;
  purgedOwnerRequestCount: number;
};

/**
 * 자유 텍스트에 적힌 전화번호 마스킹 — name·phone만 지우면 파기가 형해화된다.
 * 손님이 본문에 "010-1234-5678로 연락 주세요"라고 쓰거나 관리자가 통화 메모에
 * 번호를 옮겨 적은 경우가 실제로 생긴다(그래서 A4 메모 placeholder도 경고한다).
 * 지우지 않고 마스킹하는 이유: 문의 내용 자체는 통계·소명자료로 남겨야 한다.
 */
const PHONE_IN_TEXT = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

export function maskPhonesInText(text: string): string {
  return text.replace(PHONE_IN_TEXT, "[연락처 파기됨]");
}

/** 보유 기간이 지난 접수분의 연락처를 파기한다. 멱등 — 이미 파기된 행은 건너뛴다 */
export async function purgeExpiredContacts(db: Db): Promise<PurgeResult> {
  const retentionMonths = await readRetentionMonths(db);
  const deadline = new Date();
  deadline.setMonth(deadline.getMonth() - retentionMonths);

  /* 대상 선별 → 본문 마스킹 → 식별정보 제거. contactPurgedAt이 없는 행이 대상이므로 멱등하다.
     createdIp도 개인정보라 함께 지운다(스팸 판정은 보유 기간 안에서만 쓴다). */
  const targetInquiries = await db
    .select({ id: inquiries.id, message: inquiries.message, adminMemo: inquiries.adminMemo })
    .from(inquiries)
    .where(and(lt(inquiries.createdAt, deadline), isNull(inquiries.contactPurgedAt)));

  for (const target of targetInquiries) {
    await db
      .update(inquiries)
      .set({
        name: null,
        phone: null,
        createdIp: null,
        message: maskPhonesInText(target.message),
        adminMemo: target.adminMemo === null ? null : maskPhonesInText(target.adminMemo),
        contactPurgedAt: new Date(),
      })
      .where(eq(inquiries.id, target.id));
  }

  // 연락 이력 메모에 옮겨 적힌 번호도 함께 마스킹 — 이력 자체는 소명자료라 남긴다
  if (targetInquiries.length > 0) {
    const logRows = await db
      .select({ id: inquiryLogs.id, memo: inquiryLogs.memo })
      .from(inquiryLogs)
      .where(
        and(
          inArray(
            inquiryLogs.inquiryId,
            targetInquiries.map((target) => target.id),
          ),
          isNotNull(inquiryLogs.memo),
        ),
      );
    for (const logRow of logRows) {
      if (logRow.memo === null) continue;
      const masked = maskPhonesInText(logRow.memo);
      if (masked !== logRow.memo) {
        await db.update(inquiryLogs).set({ memo: masked }).where(eq(inquiryLogs.id, logRow.id));
      }
    }
  }

  const targetOwnerRequests = await db
    .select({
      id: ownerRequests.id,
      message: ownerRequests.message,
      adminMemo: ownerRequests.adminMemo,
    })
    .from(ownerRequests)
    .where(and(lt(ownerRequests.createdAt, deadline), isNull(ownerRequests.contactPurgedAt)));

  for (const target of targetOwnerRequests) {
    await db
      .update(ownerRequests)
      .set({
        name: null,
        phone: null,
        createdIp: null,
        message: target.message === null ? null : maskPhonesInText(target.message),
        adminMemo: target.adminMemo === null ? null : maskPhonesInText(target.adminMemo),
        contactPurgedAt: new Date(),
      })
      .where(eq(ownerRequests.id, target.id));
  }

  return {
    retentionMonths,
    purgedInquiryCount: targetInquiries.length,
    purgedOwnerRequestCount: targetOwnerRequests.length,
  };
}

/** 파기 예정일 — A4 개인정보 보관 카드 표기용 */
export function contactPurgeDueAt(createdAt: Date, retentionMonths: number): Date {
  const dueAt = new Date(createdAt);
  dueAt.setMonth(dueAt.getMonth() + retentionMonths);
  return dueAt;
}
