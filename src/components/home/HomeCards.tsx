import Link from "next/link";

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

/**
 * 홈(확정안 M1/PC1) 매물 카드 모음 — 서버 렌더 순수 컴포넌트.
 * 데이터 형태는 property.homeSummary 응답과 동형이다(지도 MapCardDatum과 같은 모양).
 */
export type HomeCardDatum = {
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

function cardMetaText(property: HomeCardDatum): string {
  return `${formatArea(property.exclusiveArea)} · ${formatFloor(property)}`;
}

function DealBadge({ dealType }: { dealType: DealType }) {
  const color = DEAL_COLOR[dealType];
  return (
    <span
      className="self-start rounded-[4px] px-[5px] py-[3px] text-[10px] leading-none font-bold"
      style={{ color: color.fg, background: color.bg }}
    >
      {DEAL_TYPE_LABEL[dealType]}
    </span>
  );
}

function Thumb({ property, className }: { property: HomeCardDatum; className: string }) {
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
        <span className="absolute right-1 bottom-1 rounded-[4px] bg-ink/70 px-1 py-0.5 text-[9px] font-bold text-white">
          <span aria-hidden>▶</span>
          <span className="sr-only">영상 있음</span>
        </span>
      )}
    </span>
  );
}

/** M1 "오늘 새로 나온 자리" 가로 레일 카드 — 확정값 158px */
export function HomeRailCard({ property }: { property: HomeCardDatum }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex w-[158px] flex-none flex-col overflow-hidden rounded-xl border border-[#EAE5DC] bg-surface"
    >
      <Thumb property={property} className="h-[88px] w-full" />
      <span className="flex flex-col gap-[3px] px-2.5 pt-[9px] pb-[11px]">
        <DealBadge dealType={property.dealType} />
        <span className="num text-[15px] leading-tight font-extrabold tracking-[-0.5px] text-ink">
          {formatPropertyPrice(property)}
        </span>
        <span className="truncate text-[11.5px] font-semibold text-[#22343C]">
          {property.title}
        </span>
        <span className="num truncate text-[10.5px] font-medium text-ink-40">
          {cardMetaText(property)}
        </span>
      </span>
    </Link>
  );
}

/** M1 "추천 상가" 세로 행 카드 — 확정값 사진 96×72 */
export function HomeRowCard({ property }: { property: HomeCardDatum }) {
  return (
    <Link href={`/properties/${property.id}`} className="flex items-center gap-[11px]">
      <Thumb property={property} className="h-[72px] w-24 flex-none rounded-[9px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <DealBadge dealType={property.dealType} />
        <span className="num text-base leading-tight font-extrabold tracking-[-0.5px] text-ink">
          {formatPropertyPrice(property)}
        </span>
        <span className="truncate text-[12.5px] font-semibold text-[#22343C]">
          {property.title}
        </span>
        <span className="num truncate text-[11px] font-medium text-ink-40">
          {cardMetaText(property)}
        </span>
      </span>
    </Link>
  );
}

/** PC1 "오채영 PICK" 네이비 밴드 카드 */
export function PcPickCard({ property }: { property: HomeCardDatum }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex flex-col overflow-hidden rounded-[11px] bg-white/5 transition-colors duration-150 hover:bg-white/10"
    >
      <span className="relative block h-28 overflow-hidden bg-[#1A3644]">
        {property.thumbPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
          <img
            src={`/uploads/${property.thumbPath}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[9.5px] font-semibold text-white/40">
            사진 준비 중
          </span>
        )}
        <span className="absolute top-[7px] left-[7px] flex gap-1">
          <span className="rounded-[3px] bg-gold px-[5px] py-[3px] text-[9.5px] leading-none font-extrabold text-ink">
            PICK
          </span>
          <span className="rounded-[3px] bg-black/40 px-[5px] py-[3px] text-[9.5px] leading-none font-bold text-white">
            {BUILDING_TYPE_LABEL[property.buildingType]}
          </span>
        </span>
      </span>
      <span className="flex flex-col gap-1 px-[11px] pt-2.5 pb-3">
        <span className="truncate text-[12.5px] font-semibold text-white">{property.title}</span>
        <span className="truncate text-[10.5px] font-medium text-white/55">◎ {property.dong}</span>
        <span className="num text-[15px] font-extrabold tracking-[-0.5px] text-gold">
          {formatPropertyPrice(property)}
        </span>
      </span>
    </Link>
  );
}

/** PC1 "오늘 새로 나온 상가" 4열 그리드 카드 */
export function PcGridCard({ property }: { property: HomeCardDatum }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex flex-col overflow-hidden rounded-[13px] border border-[#EAE5DC] bg-surface transition-shadow duration-150 hover:shadow-float"
    >
      <span className="relative block h-[148px] overflow-hidden bg-[#E7E2D9]">
        {property.thumbPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
          <img
            src={`/uploads/${property.thumbPath}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] font-semibold text-[#A79E90]">
            사진 준비 중
          </span>
        )}
        <span
          className="absolute top-[9px] left-[9px] rounded-[4px] px-1.5 py-1 text-[10.5px] leading-none font-bold"
          style={{
            color: DEAL_COLOR[property.dealType].fg,
            background: DEAL_COLOR[property.dealType].bg,
          }}
        >
          {DEAL_TYPE_LABEL[property.dealType]}
        </span>
      </span>
      <span className="flex flex-col gap-[5px] px-[15px] pt-[13px] pb-[15px]">
        <span className="text-[11.5px] font-semibold text-ink-40">
          {BUILDING_TYPE_LABEL[property.buildingType]} · {property.dong}
        </span>
        <span className="num text-[21px] leading-tight font-extrabold tracking-[-0.8px] text-ink">
          {formatPropertyPrice(property)}
        </span>
        <span className="truncate text-[13.5px] font-semibold text-ink">{property.title}</span>
        <span className="num truncate text-xs font-medium text-ink-40">
          {cardMetaText(property)}
        </span>
      </span>
    </Link>
  );
}

/** 영상 매물 레일 카드 — videoUrl 보유 매물만 이 레일에 온다 */
export function VideoRailCard({ property }: { property: HomeCardDatum }) {
  return (
    <Link href={`/properties/${property.id}`} className="flex w-[210px] flex-none flex-col gap-1.5">
      <span className="relative block h-[118px] overflow-hidden rounded-xl bg-[#E7E2D9]">
        {property.thumbPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
          <img
            src={`/uploads/${property.thumbPath}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] font-semibold text-[#A79E90]">
            사진 준비 중
          </span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 pl-0.5 text-[13px] text-white">
            ▶
          </span>
        </span>
      </span>
      <span className="truncate text-[12.5px] font-semibold text-[#22343C]">{property.title}</span>
      <span className="num text-[13px] leading-none font-extrabold tracking-[-0.4px] text-ink">
        {formatPropertyPrice(property)}
      </span>
    </Link>
  );
}

/** M1 빠른 진입 타일 — 실건수 표기(README M1 §3) */
export function QuickTile({
  href,
  tileIcon,
  tileLabel,
  tileCaption,
}: {
  href: string;
  tileIcon: React.ReactNode;
  tileLabel: string;
  tileCaption: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col items-center gap-1.5 rounded-xl border border-[#EAE5DC] bg-[#FBFAF7] px-1.5 pt-3 pb-2.5"
    >
      <span aria-hidden className="text-accent">
        {tileIcon}
      </span>
      <span className="text-[11.5px] leading-none font-bold text-[#22343C]">{tileLabel}</span>
      <span className="num text-[10.5px] leading-none font-semibold text-ink-40">
        {tileCaption}
      </span>
    </Link>
  );
}

/** M1 섹션 래퍼 — 제목 + "전체 ›" */
export function HomeSection({
  sectionTitle,
  moreHref,
  children,
}: {
  sectionTitle: string;
  moreHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 px-5 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold tracking-[-0.4px] text-ink">{sectionTitle}</h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="-mx-2 inline-flex min-h-11 items-center px-2 text-xs font-semibold text-ink-70"
          >
            전체 ›
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** 매물 0건 빈 상태 (핸드오프 "개발 전 확인" §7) — 구어체 톤 유지 */
export function EmptyPropertiesNote() {
  return (
    <p className="rounded-xl border border-dashed border-[#D4CFC6] bg-[#FBFAF7] px-4 py-5 text-[12.5px] leading-[1.6] text-ink-70">
      매물을 준비하고 있습니다.
      <br />
      전화 주시면 나와 있는 자리부터 안내드릴게요.
    </p>
  );
}
