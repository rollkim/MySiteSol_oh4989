import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import type { Db } from "@/db";
import { ownerRequests } from "@/db/schema";
import type { DealType } from "@/lib/codes";

/**
 * 매물 등록 의뢰(집주인용) 접수 — 문의(inquiry.service)와 같은 방어를 쓴다.
 * 레이트리밋은 의뢰 테이블 자체로 센다(문의와 합산하지 않는다 — 정상 사용자가
 * 문의 후 의뢰를 남기는 흐름을 막지 않기 위해).
 */

const RATE_LIMIT_PER_HOUR = 5;

export class OwnerRequestRateLimitError extends Error {
  constructor() {
    super("의뢰 접수가 너무 잦습니다. 1시간 뒤 다시 시도하시거나 전화로 연락해 주세요.");
    this.name = "OwnerRequestRateLimitError";
  }
}

export async function createOwnerRequest(
  db: Db,
  input: {
    name: string;
    phone: string;
    addressHint: string | null;
    dealType: DealType | null;
    message: string | null;
  },
  clientIp: string | null,
): Promise<{ ownerRequestId: number }> {
  if (clientIp !== null) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db
      .select({ requestCount: count() })
      .from(ownerRequests)
      .where(and(eq(ownerRequests.createdIp, clientIp), gte(ownerRequests.createdAt, oneHourAgo)));
    if (recent.requestCount >= RATE_LIMIT_PER_HOUR) throw new OwnerRequestRateLimitError();
  }

  const [inserted] = await db
    .insert(ownerRequests)
    .values({
      name: input.name,
      phone: input.phone,
      addressHint: input.addressHint,
      dealType: input.dealType,
      message: input.message,
      privacyConsentAt: new Date(), // 동의 없이는 라우터가 여길 못 온다
      createdIp: clientIp,
    })
    .returning({ id: ownerRequests.id });
  return { ownerRequestId: inserted.id };
}
