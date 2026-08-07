import Link from "next/link";

import { Building, Building2, Map as MapIcon, Phone, Store } from "lucide-react";

import {
  EmptyPropertiesNote,
  HomeRailCard,
  HomeRowCard,
  HomeSection,
  PcGridCard,
  PcPickCard,
  QuickTile,
  VideoRailCard,
} from "@/components/home/HomeCards";
import { HomeSearchBar } from "@/components/home/HomeSearchBar";
import { PcSearchPanel } from "@/components/home/PcSearchPanel";
import { TrustBlock } from "@/components/home/TrustBlock";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteTabBar } from "@/components/layout/SiteTabBar";
import {
  HERO_MOBILE_SUB_LINES,
  HERO_MOBILE_TITLE_LINES,
  HERO_PC_EYEBROW,
  HERO_PC_SUB,
  HERO_PC_TITLE_PARTS,
  HERO_STATS,
  OWNER_QUOTE,
  PROFILE_ALT,
} from "@/lib/brand";
import { getServerCaller } from "@/server/trpc/caller";

/**
 * 홈 — 확정안 M1(검색 우선) / PC1(S안 · 검색 우선 · 네이비).
 * 서버 컴포넌트: homeSummary + officeInfo를 caller로 받아 렌더한다(RULE-14).
 * 카피는 구어체 원문(brand.ts) 그대로 — 다듬지 않는다.
 */
export default async function HomePage() {
  const caller = await getServerCaller();
  const [homeSummary, officeInfo] = await Promise.all([
    caller.property.homeSummary(),
    caller.siteSetting.officeInfo(),
  ]);
  const { latestItems, storeItems, videoItems, buildingCounts } = homeSummary;

  const pcTypeTiles = [
    { tileLabel: "1층 상가", tileCount: buildingCounts.firstFloorStoreCount, href: "/map?bt=STORE" },
    { tileLabel: "2층 이상", tileCount: buildingCounts.upperFloorStoreCount, href: "/map?bt=STORE" },
    { tileLabel: "무권리", tileCount: buildingCounts.noPremiumStoreCount, href: "/map?bt=STORE" },
    { tileLabel: "오피스텔", tileCount: buildingCounts.officetelCount, href: "/map?bt=OFFICETEL" },
    { tileLabel: "아파트", tileCount: buildingCounts.aptCount, href: "/map?bt=APT" },
    { tileLabel: "영상 매물", tileCount: buildingCounts.videoCount, href: "/map" },
  ];

  return (
    <div className="min-h-dvh bg-surface pb-16 lg:pb-0">
      <SiteHeader officeInfo={officeInfo} />

      {/* ─────────── 모바일 · 확정안 M1 ─────────── */}
      <main className="lg:hidden">
        {/* 히어로 — 배곧 상권 사진 + 네이비 오버레이 + 검색바 */}
        <section className="relative overflow-hidden bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
          <img
            src="/brand/hero-street.jpg"
            alt=""
            aria-hidden
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(11,36,48,.30) 0%, rgba(11,36,48,.10) 40%, rgba(11,36,48,.62) 100%)",
            }}
          />
          <div className="relative flex flex-col gap-[18px] px-5 pt-3 pb-[26px]">
            <div className="flex flex-col gap-[9px]">
              <h1 className="text-[27px] leading-[1.28] font-extrabold tracking-[-1.1px] text-white">
                {HERO_MOBILE_TITLE_LINES[0]}
                <br />
                {HERO_MOBILE_TITLE_LINES[1]}
              </h1>
              <p className="text-[13px] leading-[1.6] text-[#9FBCC5]">
                {HERO_MOBILE_SUB_LINES[0]}
                <br />
                {HERO_MOBILE_SUB_LINES[1]}
              </p>
            </div>
            <HomeSearchBar />
          </div>
        </section>

        {/* 빠른 진입 4타일 — 확정 quick(상가/아파트/오피스텔/지도) + 실건수 */}
        <section className="px-5 pt-[18px]">
          <div className="grid grid-cols-4 gap-[9px]">
            <QuickTile
              href="/map?bt=STORE"
              tileIcon={<Store size={18} strokeWidth={2} />}
              tileLabel="상가"
              tileCaption={`${buildingCounts.storeCount}건`}
            />
            <QuickTile
              href="/map?bt=APT"
              tileIcon={<Building2 size={18} strokeWidth={2} />}
              tileLabel="아파트"
              tileCaption={`${buildingCounts.aptCount}건`}
            />
            <QuickTile
              href="/map?bt=OFFICETEL"
              tileIcon={<Building size={18} strokeWidth={2} />}
              tileLabel="오피스텔"
              tileCaption={`${buildingCounts.officetelCount}건`}
            />
            <QuickTile
              href="/map"
              tileIcon={<MapIcon size={18} strokeWidth={2} />}
              tileLabel="지도"
              tileCaption={`전체 ${buildingCounts.totalCount}건`}
            />
          </div>
        </section>

        {/* 오늘 새로 나온 자리 — 가로 레일 */}
        <HomeSection sectionTitle="오늘 새로 나온 자리" moreHref="/map?sheet=full">
          {latestItems.length > 0 ? (
            <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
              {latestItems.map((property) => (
                <HomeRailCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <EmptyPropertiesNote />
          )}
        </HomeSection>

        {/* 추천 상가 — 세로 행 */}
        {storeItems.length > 0 && (
          <HomeSection sectionTitle="추천 상가" moreHref="/map?bt=STORE">
            <div className="flex flex-col gap-3">
              {storeItems.map((property) => (
                <HomeRowCard key={property.id} property={property} />
              ))}
            </div>
          </HomeSection>
        )}

        <TrustBlock officeInfo={officeInfo} />

        {/* 영상으로 보는 매물 — videoUrl 보유 매물만 */}
        {videoItems.length > 0 && (
          <HomeSection sectionTitle="영상으로 보는 매물" moreHref="/map">
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {videoItems.map((property) => (
                <VideoRailCard key={property.id} property={property} />
              ))}
            </div>
          </HomeSection>
        )}

        <div className="h-8" aria-hidden />
      </main>

      {/* ─────────── PC · 확정안 PC1 (S안) ─────────── */}
      <main className="hidden lg:block">
        {/* 히어로 — 상단 236px 사진 밴드 + 카피 + 검색 패널 + 유형 타일 + 성과/대표 행 */}
        <section className="relative overflow-hidden bg-[#FBFAF7]">
          {/* 사진 밴드 — 확정 시안은 1464px 프레임 기준 236px. 넓은 모니터에서는
              같은 비율로 보이도록 단계적으로 키운다(시안보다 작아 보이는 문제 보정) */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-[236px] bg-ink xl:h-[286px] 2xl:h-[320px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
            <img
              src="/brand/hero-street.jpg"
              alt=""
              fetchPriority="high"
              className="h-full w-full object-cover opacity-[0.34]"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(11,36,48,.4) 0%, rgba(11,36,48,0) 26%, rgba(11,36,48,.6) 100%)",
              }}
            />
          </div>
          <div className="relative mx-auto flex w-full max-w-[1168px] flex-col items-center gap-[22px] px-6 pt-[34px] pb-9 xl:max-w-[1320px] xl:gap-7 xl:pt-11">
            <div className="flex flex-col items-center gap-[11px] text-center">
              <span className="text-[12.5px] font-bold tracking-[0.03em] text-gold xl:text-[13.5px]">
                {HERO_PC_EYEBROW}
              </span>
              {/* 확정 토큰의 PC 히어로 카피는 50px/800/-2px — 1464 프레임에선 40px로 그려졌다.
                  넓은 화면에서 작아 보이지 않게 xl 이상에서 토큰 값으로 올린다 */}
              <h1 className="text-[40px] leading-[1.24] font-extrabold tracking-[-1.7px] text-white xl:text-[50px] xl:tracking-[-2px]">
                {HERO_PC_TITLE_PARTS[0]}
                <span className="text-gold">{HERO_PC_TITLE_PARTS[1]}</span>
                {HERO_PC_TITLE_PARTS[2]}
              </h1>
              <p className="text-[14.5px] text-white/85 xl:text-[16.5px]">{HERO_PC_SUB}</p>
            </div>

            <PcSearchPanel />

            <div className="grid w-full grid-cols-6 gap-[11px]">
              {pcTypeTiles.map((typeTile) => (
                <Link
                  key={typeTile.tileLabel}
                  href={typeTile.href}
                  className="flex h-[76px] flex-col items-center justify-center gap-[5px] rounded-[11px] border border-[#EAE5DC] bg-surface transition-colors duration-150 hover:border-accent xl:h-[88px]"
                >
                  <span className="text-[13.5px] font-bold tracking-[-0.3px] text-[#22343C] xl:text-[15px]">
                    {typeTile.tileLabel}
                  </span>
                  <span className="num text-[11.5px] font-bold text-accent xl:text-[12.5px]">
                    {typeTile.tileCount}건
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex w-full items-center justify-between gap-6">
              <div className="flex gap-[30px]">
                {HERO_STATS.map((heroStat) => (
                  <div key={heroStat.statLabel} className="flex flex-col gap-0.5">
                    <span className="num text-[22px] font-extrabold tracking-[-0.8px] text-[#22343C] xl:text-[26px]">
                      {heroStat.statValue}
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-40 xl:text-[12.5px]">
                      {heroStat.statLabel}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex min-w-0 items-center justify-end gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
                <img
                  src="/brand/ohc-profile.jpg"
                  alt={officeInfo ? `대표 ${officeInfo.ownerName}` : PROFILE_ALT}
                  className="h-[42px] w-[42px] flex-none rounded-full object-cover [object-position:50%_22%]"
                />
                <span className="truncate text-[13.5px] font-semibold text-[#22343C] xl:text-[15px]">
                  {OWNER_QUOTE}
                </span>
                {officeInfo && (
                  <a
                    href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
                    className="flex h-10 flex-none items-center gap-2 rounded-[9px] bg-gold px-[17px] text-[13.5px] font-bold text-ink"
                  >
                    <Phone size={13} strokeWidth={2.4} aria-hidden />
                    <span className="num">{officeInfo.officePhone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 오채영 PICK — 네이비 밴드 */}
        {latestItems.length > 0 && (
          <section className="bg-ink px-12 py-6">
            <div className="mx-auto flex max-w-[1368px] flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.4px] text-white">
                  <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-gold" />
                  오채영 PICK
                </h2>
                <Link href="/map" className="text-[12.5px] font-bold text-white/70">
                  직접 보고 온 자리만 올립니다 · 전체 보기 →
                </Link>
              </div>
              <div className="grid grid-cols-6 gap-3.5">
                {latestItems.slice(0, 6).map((property) => (
                  <PcPickCard key={property.id} property={property} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 오늘 새로 나온 상가 — 4열 그리드 */}
        <section className="px-12 py-7">
          <div className="mx-auto flex max-w-[1368px] flex-col gap-[18px]">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-[23px] font-extrabold tracking-[-0.8px] text-[#22343C]">
                  오늘 새로 나온 상가
                </h2>
                <p className="text-[13px] text-ink-40">
                  권리금·배후세대·유동인구까지 확인하고 올립니다
                </p>
              </div>
              <Link href="/map?bt=STORE" className="text-[13.5px] font-bold text-accent">
                상가 전체 보기 →
              </Link>
            </div>
            {storeItems.length > 0 ? (
              <div className="grid grid-cols-4 gap-[18px]">
                {storeItems.map((property) => (
                  <PcGridCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <EmptyPropertiesNote />
            )}
          </div>
        </section>

        {/* 영상으로 보는 매물 */}
        {videoItems.length > 0 && (
          <section className="px-12 pb-9">
            <div className="mx-auto flex max-w-[1368px] flex-col gap-[18px]">
              <h2 className="text-[23px] font-extrabold tracking-[-0.8px] text-[#22343C]">
                영상으로 보는 매물
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {videoItems.map((property) => (
                  <VideoRailCard key={property.id} property={property} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter officeInfo={officeInfo} />
      <SiteTabBar />
    </div>
  );
}
