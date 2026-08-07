import { NextResponse } from "next/server";

import { db } from "@/db";
import { purgeExpiredContacts } from "@/server/services/inquiry-purge.service";

/**
 * 연락처 자동 파기 — 서버 crontab이 하루 1회 호출한다.
 * 개인정보처리방침에 "접수일로부터 3개월 후 자동 파기"를 공표했으므로,
 * 관리자 화면의 수동 버튼만으로는 약속을 지킬 수 없다.
 *
 * 인증: CRON_SECRET(서버 env)과 Authorization 헤더를 상수시간 비교.
 * 미설정이면 **동작하지 않는다** — 비밀 없이 열린 파기 엔드포인트가 되는 것을 막는다.
 *
 * 서버 등록 예:
 *   0 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/purge-contacts
 */
export async function POST(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET 미설정 — 파기 배치를 실행하지 않습니다.");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredContacts(db);
    console.info(
      `[cron] 연락처 파기 — 문의 ${result.purgedInquiryCount}건 · 의뢰 ${result.purgedOwnerRequestCount}건 (보유 ${result.retentionMonths}개월)`,
    );
    return NextResponse.json(result);
  } catch (purgeError) {
    console.error("[cron] 연락처 파기 실패:", purgeError);
    return NextResponse.json({ error: "purge failed" }, { status: 500 });
  }
}

/** GET도 허용 — crontab에서 curl 한 줄로 부르기 쉽게(인증은 동일) */
export const GET = POST;
