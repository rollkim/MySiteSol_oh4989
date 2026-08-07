"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PropertyDetailBody } from "@/components/property/PropertyDetailBody";
import type { OfficeInfo } from "@/server/services/site-settings.service";
import { useTRPC } from "@/trpc/client";

/**
 * PC 3분할의 중앙 상세 패널 (§4-P1, 580px) — 선택 전에는 안내+인기 지역,
 * 선택하면 상세 페이지와 **같은 본문**(PropertyDetailBody)을 렌더한다.
 */
export function DetailPanel({
  selectedPropertyId,
  officeInfo,
  onRegionClick,
}: {
  selectedPropertyId: number | null;
  officeInfo: OfficeInfo | null;
  /** 인기 지역 바로가기 → 지도 이동 */
  onRegionClick: (region: { label: string; lat: number; lng: number }) => void;
}) {
  const trpc = useTRPC();
  const detail = useQuery(
    trpc.property.detail.queryOptions(
      { propertyId: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId !== null, staleTime: 30_000, retry: false },
    ),
  );

  if (selectedPropertyId === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-ink-70">
          지도를 움직여 매물을 찾아보세요.
          <br />
          마커나 왼쪽 목록을 누르면 여기에 상세가 열립니다.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {/* 인기 지역 바로가기 — 주력 상권(참고문서 §0) */}
          {[
            { label: "배곧동", lat: 37.3799, lng: 126.7291 },
            { label: "정왕동", lat: 37.3454, lng: 126.7413 },
          ].map((region) => (
            <button
              key={region.label}
              type="button"
              onClick={() => onRegionClick(region)}
              className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink-70 hover:bg-surface-alt"
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (detail.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-70">
        매물 정보를 불러오는 중…
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-70">
        매물 정보를 불러오지 못했습니다. 다른 매물을 선택해 보세요.
      </div>
    );
  }

  const { property, images, optionCodes } = detail.data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PropertyDetailBody
          property={property}
          images={images}
          optionCodes={optionCodes}
          officeInfo={officeInfo}
        />
      </div>
      {/* 패널 하단 고정 CTA (§4-P1: [문의] [전화]) */}
      <div className="flex gap-2 border-t border-line bg-surface p-3">
        <Link
          href={`/properties/${property.id}`}
          className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-line text-sm font-medium text-ink-70"
        >
          전체 화면
        </Link>
        <Link
          href={`/inquiry?propertyId=${property.id}`}
          className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-accent text-sm font-medium text-accent"
        >
          문의하기
        </Link>
        {officeInfo && (
          <a
            href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent text-sm font-bold text-white"
          >
            ☎ 전화
          </a>
        )}
      </div>
    </div>
  );
}
