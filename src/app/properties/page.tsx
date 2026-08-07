import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteTabBar } from "@/components/layout/SiteTabBar";
import { getServerCaller } from "@/server/trpc/caller";

import { ListScreen } from "./ListScreen";

/**
 * 매물 목록 라우트 — 확정안 M2. 목록 본문은 클라이언트(필터·무한 스크롤)이고
 * 이 서버 컴포넌트는 크롬(헤더·푸터·탭바)과 법정 표기용 officeInfo만 책임진다.
 * 데스크톱 검색의 확정 화면은 PC2(/map 3분할)라서 이 페이지는 모바일 폭 기준으로 가운데 정렬한다.
 */
export const metadata: Metadata = {
  title: "매물 목록",
  description: "시흥 배곧 상가·아파트·오피스텔 매물을 조건으로 골라보세요.",
};

export default async function PropertiesListPage() {
  const caller = await getServerCaller();
  const officeInfo = await caller.siteSetting.officeInfo();

  return (
    <div className="min-h-dvh bg-surface pb-16 lg:pb-0">
      <SiteHeader officeInfo={officeInfo} />
      <main className="mx-auto w-full max-w-3xl">
        <ListScreen />
      </main>
      <SiteFooter officeInfo={officeInfo} />
      <SiteTabBar />
    </div>
  );
}
