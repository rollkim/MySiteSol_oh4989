"use client";

import { memo } from "react";

import { DEAL_COLOR } from "@/components/map/price-tag-marker";
import { formatArea } from "@/domain/area";
import { formatFloor } from "@/domain/floor";
import { formatPropertyPrice } from "@/domain/price";
import {
  BUILDING_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  type BuildingType,
  type DealType,
  type FloorDisplay,
} from "@/lib/codes";

/** 지도 리스트·레일이 공유하는 매물 카드 데이터 — mapSearch 마커 응답과 동형 */
export type MapCardDatum = {
  id: number;
  title: string;
  dealType: DealType;
  buildingType: BuildingType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: string;
  floor: number | null;
  totalFloor: number;
  floorDisplay: FloorDisplay;
  dong: string;
  hasVideo: boolean;
  thumbPath: string | null;
};

function DealBadge({ dealType }: { dealType: DealType }) {
  const color = DEAL_COLOR[dealType];
  return (
    <span
      className="rounded-[4px] px-1.5 py-1 text-[10.5px] leading-none font-bold tracking-[-0.2px]"
      style={{ color: color.fg, background: color.bg }}
    >
      {DEAL_TYPE_LABEL[dealType]}
    </span>
  );
}

function Thumb({ property, className }: { property: MapCardDatum; className: string }) {
  return (
    <span className={`relative block overflow-hidden bg-[#E7E2D9] ${className}`}>
      {property.thumbPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
        <img
          src={`/uploads/${property.thumbPath}`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-[9.5px] font-semibold tracking-[0.02em] text-[#A79E90]">
          사진 준비 중
        </span>
      )}
      {property.hasVideo && (
        <span className="num absolute right-1 bottom-1 rounded-[4px] bg-ink/70 px-1 py-0.5 text-[9px] font-bold text-white">
          ▶
        </span>
      )}
    </span>
  );
}

/**
 * 매물 카드 — 확정 시안(baegot-map)의 두 형태:
 * list = 세로 리스트 행(vitem: 사진 104×78 좌측) · rail = 가로 스크롤 카드(hcard: 250px 세로형).
 * idle마다 리스트가 리렌더되지 않게 memo — 콜백은 id 기반 안정 함수를 받는다.
 */
export const MapCard = memo(function MapCard({
  property,
  variant = "list",
  isActive,
  onClickProperty,
  onHoverProperty,
}: {
  property: MapCardDatum;
  variant?: "list" | "rail";
  isActive: boolean;
  onClickProperty: (propertyId: number) => void;
  onHoverProperty?: (propertyId: number | null) => void;
}) {
  const priceText = formatPropertyPrice(property);
  const metaText = `${formatArea(property.exclusiveArea)} · ${formatFloor(property)}`;

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={() => onClickProperty(property.id)}
        aria-pressed={isActive}
        className="flex h-[198px] w-[250px] flex-none flex-col overflow-hidden rounded-[13px] border bg-surface text-left"
        style={
          isActive
            ? { borderColor: "var(--color-accent)", boxShadow: "0 0 0 1.5px var(--color-accent)" }
            : { borderColor: "#EAE5DC" }
        }
      >
        <Thumb property={property} className="h-24 w-full" />
        <span className="flex min-w-0 flex-col gap-1 px-[11px] pt-[9px] pb-[10px]">
          <span className="flex items-center gap-[5px]">
            <DealBadge dealType={property.dealType} />
            <span className="text-[11px] font-semibold text-ink-40">
              {BUILDING_TYPE_LABEL[property.buildingType]}
            </span>
          </span>
          <span className="num text-[17px] leading-[1.1] font-extrabold tracking-[-0.6px] text-ink">
            {priceText}
          </span>
          <span className="truncate text-[13px] font-semibold text-[#22343C]">
            {property.title}
          </span>
          <span className="num truncate text-[11.5px] font-medium text-ink-40">{metaText}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClickProperty(property.id)}
      onMouseEnter={() => onHoverProperty?.(property.id)}
      onMouseLeave={() => onHoverProperty?.(null)}
      onFocus={() => onHoverProperty?.(property.id)}
      onBlur={() => onHoverProperty?.(null)}
      aria-pressed={isActive}
      className={`flex min-h-11 w-full items-start gap-[11px] border-b border-[#F0ECE4] px-1 py-[13px] text-left transition-colors ${
        isActive ? "bg-accent-soft" : "hover:bg-surface-alt"
      }`}
    >
      <Thumb property={property} className="h-[78px] w-[104px] flex-none rounded-[9px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-[5px]">
          <DealBadge dealType={property.dealType} />
          <span className="text-[11px] font-semibold text-ink-40">
            {BUILDING_TYPE_LABEL[property.buildingType]}
          </span>
        </span>
        <span className="num text-[17px] leading-[1.1] font-extrabold tracking-[-0.6px] text-ink">
          {priceText}
        </span>
        <span className="truncate text-[13px] font-semibold text-[#22343C]">{property.title}</span>
        <span className="num truncate text-[11.5px] font-medium text-ink-40">{metaText}</span>
      </span>
    </button>
  );
});
