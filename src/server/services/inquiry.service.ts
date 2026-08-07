import "server-only";

import { and, count, eq, gte, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { inquiries, properties } from "@/db/schema";
import type { BuildingType, InquiryKind } from "@/lib/codes";

/**
 * 문의 접수 — 비회원 폼이라 스팸이 그대로 꽂힌다.
 * 레이트리밋(IP당 시간당 5회, SPEC §4)은 DB count로 판정한다 — 단일 프로세스 메모리로도
 * 되지만 재시작·재배포마다 초기화되면 방어가 아니고, `inquiries_ip_recent_idx`가 이미 있다.
 */

const RATE_LIMIT_PER_HOUR = 5;

export class InquiryRateLimitError extends Error {
  constructor() {
    super("문의가 너무 잦습니다. 1시간 뒤 다시 시도하시거나 전화로 연락해 주세요.");
    this.name = "InquiryRateLimitError";
  }
}

export async function createInquiry(
  db: Db,
  input: {
    propertyId: number | null;
    name: string;
    phone: string;
    message: string;
    inquiryKind: InquiryKind;
    interestDong: string | null;
    interestBuildingType: BuildingType | null;
    /** [선택] 광고성 정보 수신 동의 — 필수 동의와 분리(확정안 M5, 법정) */
    marketingConsent: boolean;
  },
  clientIp: string | null,
): Promise<{ inquiryId: number }> {
  // IP를 모르면(프록시 설정 누락 등) 제한을 걸 수 없다 — 접수는 받되 createdIp가 null로 남아 선별 대상이 된다
  if (clientIp !== null) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db
      .select({ inquiryCount: count() })
      .from(inquiries)
      .where(and(eq(inquiries.createdIp, clientIp), gte(inquiries.createdAt, oneHourAgo)));
    if (recent.inquiryCount >= RATE_LIMIT_PER_HOUR) throw new InquiryRateLimitError();
  }

  // 존재하지 않는 매물 id는 null로 강등 — 공개 폼의 쿼리 파라미터 조작이
  // FK 위반 500으로 터지지 않게 한다. 문의 자체는 받는다(일반 문의로 취급)
  let linkedPropertyId = input.propertyId;
  if (linkedPropertyId !== null) {
    const [exists] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, linkedPropertyId));
    if (!exists) linkedPropertyId = null;
  }

  const [inserted] = await db
    .insert(inquiries)
    .values({
      propertyId: linkedPropertyId,
      name: input.name,
      phone: input.phone,
      message: input.message,
      inquiryKind: input.inquiryKind,
      interestDong: input.interestDong,
      interestBuildingType: input.interestBuildingType,
      // 폼의 동의 체크(디자인가이드 §5-8)에 대응하는 증빙 시각 — 라우터가 동의 없인 여길 못 온다
      privacyConsentAt: new Date(),
      marketingConsentAt: input.marketingConsent ? new Date() : null,
      createdIp: clientIp,
    })
    .returning({ id: inquiries.id });
  return { inquiryId: inserted.id };
}

/** 관리자 문의함 미처리(NEW) 건수 — 대시보드 KPI·메뉴 배지용 */
export async function countNewInquiries(db: Db): Promise<number> {
  const [row] = await db
    .select({ newCount: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(eq(inquiries.status, "NEW"));
  return row.newCount;
}
