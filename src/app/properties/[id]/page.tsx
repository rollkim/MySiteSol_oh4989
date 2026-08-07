import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { TRPCError } from "@trpc/server";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PhotoCarousel } from "@/components/property/PhotoCarousel";
import {
  LegalTable,
  LocationBlock,
  MaintenanceDetailSection,
  OfficeInfoCard,
  OptionsSection,
  OwnerCommentBlock,
  PriceTitleBlock,
  PropertyDetailBody,
  SpecGrid,
  VideoSection,
} from "@/components/property/PropertyDetailBody";
import { formatPropertyPrice } from "@/domain/price";
import { BUILDING_TYPE_LABEL, DEAL_TYPE_LABEL } from "@/lib/codes";
import type { OfficeInfo } from "@/server/services/site-settings.service";
import { getServerCaller } from "@/server/trpc/caller";

import { BackOverlay } from "./BackOverlay";

/**
 * 공개 매물 상세 — 확정안 M4(모바일 단열) / PC3(좌 본문 + 우 372px sticky 레일).
 * 본문 블록은 PropertyDetailBody의 조각들을 두 조립이 공유한다(법정 표기 단일 구현).
 * 동적 SSR — 매 요청 DB를 읽으므로 거래완료 전환이 즉시 반영된다(RULE-11).
 */

/** 요청당 1회로 dedupe — generateMetadata와 페이지가 각각 불러도 쿼리·조회수는 한 번 */
const getPropertyDetail = cache(async (propertyId: number) => {
  try {
    const caller = await getServerCaller();
    return await caller.property.detail({ propertyId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});

function parsePropertyId(rawId: string): number | null {
  const propertyId = Number(rawId);
  return Number.isInteger(propertyId) && propertyId > 0 ? propertyId : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const propertyId = parsePropertyId((await params).id);
  if (propertyId === null) return {};
  const detail = await getPropertyDetail(propertyId);
  if (!detail) return {};
  const { property } = detail;
  return {
    title: property.title,
    description: `${property.sigungu} ${property.dong} · ${BUILDING_TYPE_LABEL[property.buildingType]} · ${DEAL_TYPE_LABEL[property.dealType]} ${formatPropertyPrice(property)}`,
  };
}

type RelatedProperty = {
  id: number;
  title: string;
  dealType: "SALE" | "JEONSE" | "MONTHLY" | "SHORT";
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  dong: string;
  thumbPath: string | null;
};

function RelatedThumb({ relatedProperty }: { relatedProperty: RelatedProperty }) {
  return relatedProperty.thumbPath ? (
    // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
    <img
      src={`/uploads/${relatedProperty.thumbPath}`}
      alt=""
      className="aspect-[4/3] w-full object-cover"
      loading="lazy"
    />
  ) : (
    <div className="aspect-[4/3] bg-surface-alt" />
  );
}

/** 연락 카드 — 확정 PC3 우측 레일: 전화(채움)·문자(외곽)·카톡(있을 때). 폼 문의는 보조 경로 */
function ContactCard({
  officeInfo,
  propertyId,
}: {
  officeInfo: OfficeInfo | null;
  propertyId: number;
}) {
  if (!officeInfo) return null;
  const smsNumber = (officeInfo.mobilePhone ?? officeInfo.officePhone).replaceAll("-", "");
  return (
    <section className="flex flex-col gap-2 rounded-[13px] border border-line bg-surface p-4">
      <a
        href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
        className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-accent text-sm font-extrabold text-white"
      >
        전화 상담 <span className="num">{officeInfo.officePhone}</span>
      </a>
      <a
        href={`sms:${smsNumber}`}
        className="flex h-11 items-center justify-center rounded-[10px] border border-accent text-sm font-bold text-accent"
      >
        문자 문의
      </a>
      {officeInfo.kakaoChannelUrl && (
        <a
          href={officeInfo.kakaoChannelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center rounded-[10px] bg-gold text-sm font-bold text-ink"
        >
          카카오톡 상담
        </a>
      )}
      <Link
        href={`/inquiry?propertyId=${propertyId}`}
        className="flex min-h-11 items-center justify-center text-[12.5px] font-semibold text-ink-70 underline underline-offset-2"
      >
        폼으로 문의 남기기
      </Link>
    </section>
  );
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const propertyId = parsePropertyId((await params).id);
  if (propertyId === null) notFound();

  const detail = await getPropertyDetail(propertyId);
  if (!detail) notFound();
  const { property, images, optionCodes } = detail;

  // detail과 무관한 officeInfo는 related(dong 의존)와 병렬로
  const caller = await getServerCaller();
  const [relatedProperties, officeInfo] = await Promise.all([
    caller.property.related({ propertyId, dong: property.dong }),
    caller.siteSetting.officeInfo(),
  ]);

  return (
    <>
      {/* PC만 사이트 헤더 — 모바일 M4는 사진 위 뒤로가기 오버레이가 그 역할 */}
      <div className="hidden lg:block">
        <SiteHeader officeInfo={officeInfo} />
      </div>

      {/* ─────────── 모바일 · 확정안 M4 ─────────── */}
      <main className="mx-auto max-w-3xl pb-24 lg:hidden">
        <div className="relative">
          <BackOverlay />
          <PropertyDetailBody
            property={property}
            images={images}
            optionCodes={optionCodes}
            officeInfo={officeInfo}
          />
        </div>

        {/* 같은 지역 다른 매물 */}
        {relatedProperties.length > 0 && (
          <section className="px-4 pb-4">
            <h2 className="text-sm font-bold">{property.dong} 다른 매물</h2>
            <ul className="mt-2 grid grid-cols-3 gap-3">
              {relatedProperties.map((relatedProperty) => (
                <li key={relatedProperty.id}>
                  <Link
                    href={`/properties/${relatedProperty.id}`}
                    className="block overflow-hidden rounded-md border border-line bg-surface"
                  >
                    <RelatedThumb relatedProperty={relatedProperty} />
                    <div className="p-2">
                      <p className="num text-sm font-bold">
                        {formatPropertyPrice(relatedProperty)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-70">
                        {relatedProperty.title}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 하단 고정 CTA — 확정 M4: 전화 상담(틸 채움) + 문자 문의(외곽) */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface p-3 shadow-sheet">
          <div className="mx-auto flex max-w-3xl gap-2">
            {officeInfo ? (
              <>
                <a
                  href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
                  className="flex min-h-11 flex-[2] items-center justify-center gap-1.5 rounded-[10px] bg-accent text-sm font-extrabold text-white"
                >
                  전화 상담 <span className="num">{officeInfo.officePhone}</span>
                </a>
                <a
                  href={`sms:${(officeInfo.mobilePhone ?? officeInfo.officePhone).replaceAll("-", "")}`}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-accent text-sm font-bold text-accent"
                >
                  문자 문의
                </a>
              </>
            ) : (
              <Link
                href={`/inquiry?propertyId=${property.id}`}
                className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white"
              >
                문의하기
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* ─────────── PC · 확정안 PC3 (좌 본문 + 우 sticky 레일) ─────────── */}
      {/* 확정 PC3: 좌 964 + 간격 32 + 우 372 = 1368 콘텐츠 폭 */}
      <main className="mx-auto hidden w-full max-w-[1400px] gap-8 px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_372px]">
        {/* aside(h1 보유)를 DOM상 먼저 — 헤딩 순서(h1→h2) 보존. 시각 배치는 grid col로 우측 유지 */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
          <div className="rounded-[13px] border border-line bg-surface p-5">
            <PriceTitleBlock property={property} />
          </div>
          <ContactCard officeInfo={officeInfo} propertyId={property.id} />
          <OfficeInfoCard officeInfo={officeInfo} />
          {relatedProperties.length > 0 && (
            <section className="rounded-[13px] border border-line bg-surface p-4">
              <h2 className="text-sm font-bold">비슷한 매물</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {relatedProperties.map((relatedProperty) => (
                  <li key={relatedProperty.id}>
                    <Link
                      href={`/properties/${relatedProperty.id}`}
                      className="flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-surface-alt"
                    >
                      <span className="block w-20 flex-none overflow-hidden rounded-md">
                        <RelatedThumb relatedProperty={relatedProperty} />
                      </span>
                      <span className="min-w-0">
                        <span className="num block text-sm font-bold">
                          {formatPropertyPrice(relatedProperty)}
                        </span>
                        <span className="block truncate text-xs text-ink-70">
                          {relatedProperty.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-7 lg:col-start-1 lg:row-start-1">
          <div className="overflow-hidden rounded-[13px]">
            <PhotoCarousel images={images} title={property.title} />
          </div>
          <SpecGrid property={property} columnsClass="grid-cols-4" />
          <OwnerCommentBlock property={property} officeInfo={officeInfo} />
          <LocationBlock property={property} mapHeightClass="h-80" />
          <VideoSection property={property} />
          <OptionsSection optionCodes={optionCodes} />
          <MaintenanceDetailSection property={property} />
          {/* 확정 PC3 "건축물 · 개발 정보" 자리 — 법정 명시항목 전체 표 */}
          <LegalTable property={property} />
        </div>
      </main>

      {/* 모바일 고정 CTA에 가리지 않게 푸터에 하단 여백 */}
      <div className="pb-20 lg:pb-0">
        <SiteFooter officeInfo={officeInfo} />
      </div>
    </>
  );
}
