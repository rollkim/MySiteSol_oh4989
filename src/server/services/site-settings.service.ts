import "server-only";

import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { siteSettings } from "@/db/schema";

/**
 * 중개사무소 법정정보 (공인중개사법 제18조의2, 디자인가이드 §8).
 * 리스킨의 교체 지점이라 하드코딩하지 않고 site_settings에서 읽는다(RULE-11).
 * ⚠️ 중개보조원 정보는 어떤 필드로도 만들지 않는다 — 표기 금지 항목이다.
 */
export type OfficeInfo = {
  officeName: string;
  officeAddress: string;
  officePhone: string;
  registrationNumber: string;
  /** 개업공인중개사 성명 */
  ownerName: string;
  /* ── 이하 확정안 PC4 푸터 확장 필드 — settingValue(jsonb)에 없으면 해당 줄을 숨긴다 ── */
  /** 사업자등록번호 (532-28-00914 형식) */
  businessRegistrationNumber?: string;
  mobilePhone?: string;
  faxNumber?: string;
  /** 영업시간 대표 표기 (예: "09:30 – 19:00") — 오픈 전 대표 확인 필요 값 */
  businessHoursMain?: string;
  /** 영업시간 부가 줄들 (예: "매주 일요일 휴무") */
  businessHoursNotes?: string[];
  youtubeUrl?: string;
  blogUrl?: string;
  kakaoChannelUrl?: string;
};

export async function getOfficeInfo(db: Db): Promise<OfficeInfo | null> {
  const [row] = await db
    .select({ settingValue: siteSettings.settingValue })
    .from(siteSettings)
    .where(eq(siteSettings.settingKey, "officeInfo"));
  const officeInfo = (row?.settingValue as OfficeInfo | undefined) ?? null;
  // null이면 전 공개면이 §18의2 법정 표기 없이 매물을 광고하게 된다 — 조용히 지나가면 안 되는 상태
  if (!officeInfo || !officeInfo.officeName || !officeInfo.registrationNumber) {
    console.error(
      "[legal] site_settings.officeInfo 미설정/불완전 — 공개면 법정 표기(§18의2)를 렌더할 수 없습니다.",
    );
    return null;
  }
  return officeInfo;
}
