import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteTabBar } from "@/components/layout/SiteTabBar";
import { getServerCaller } from "@/server/trpc/caller";

import { InquiryForm } from "./InquiryForm";

export const metadata: Metadata = {
  title: "상담 문의",
  description: "배곧 매물 문의 — 남겨주신 연락처로 빠르게 연락드립니다.",
};

/**
 * 상담 문의 (확정안 M5). 매물 상세의 [폼으로 문의 남기기]에서 오면 ?propertyId=N이 실려
 * 접수에 매물이 연결된다. 매물 제목 표시는 detail 조회가 필요해 생략 — 접수 데이터에는 연결된다.
 */
export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId: rawPropertyId } = await searchParams;
  const parsedPropertyId = Number(rawPropertyId);
  const propertyId =
    Number.isInteger(parsedPropertyId) && parsedPropertyId > 0 ? parsedPropertyId : null;

  const caller = await getServerCaller();
  const officeInfo = await caller.siteSetting.officeInfo();

  return (
    <div className="min-h-dvh bg-surface pb-16 lg:pb-0">
      <SiteHeader officeInfo={officeInfo} />
      <main className="mx-auto max-w-md px-5 py-6">
        <h1 className="text-lg font-extrabold tracking-[-0.4px] text-ink">상담 문의</h1>
        {propertyId !== null && (
          <p className="mt-1 text-sm text-ink-40">보고 계신 매물에 대한 문의가 접수됩니다.</p>
        )}
        <div className="mt-4">
          <InquiryForm propertyId={propertyId} officeInfo={officeInfo} />
        </div>
      </main>
      <SiteFooter officeInfo={officeInfo} />
      <SiteTabBar />
    </div>
  );
}
