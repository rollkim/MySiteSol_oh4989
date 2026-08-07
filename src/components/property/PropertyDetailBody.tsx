import { formatArea } from "@/domain/area";
import { formatFloor } from "@/domain/floor";
import { formatMaintenanceFee, formatPremiumFee, formatPropertyPrice } from "@/domain/price";
import { isResidential } from "@/domain/property-schema";
import { PROFILE_ALT } from "@/lib/brand";
import { MiniMapClient } from "@/components/map/MiniMapClient";
import {
  BUILDING_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  MAINTENANCE_GROUP_LABEL,
  MAINTENANCE_GROUPS,
  PROPERTY_OPTION_LABEL,
  type BuildingType,
  type DealType,
  type Direction,
  type FloorDisplay,
  type MaintenanceDetail,
  type PropertyOption,
  type PropertyDealProgress,
} from "@/lib/codes";
import type { OfficeInfo } from "@/server/services/site-settings.service";

import { PhotoCarousel } from "./PhotoCarousel";
import { VideoEmbed } from "./VideoEmbed";

/**
 * 매물 상세 블록 모음 — 확정안 M4(모바일)·PC3(데스크톱)가 **같은 조각**을 다른 순서로 조립한다.
 * 법정 표기가 두 벌로 갈리면 한쪽만 고쳐지는 사고가 난다 — 블록을 단일 구현으로 유지하는 이유.
 * PropertyDetailBody = M4 확정 순서의 기본 조립(캐러셀→가격·제목→조건→대표 코멘트→지도→영상→법정).
 */

export type PropertyDetailData = {
  id: number;
  title: string;
  buildingType: BuildingType;
  dealType: DealType;
  dealProgress: PropertyDealProgress;
  priceNegotiable: boolean;
  brokerFeeNote: string | null;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: string;
  supplyArea: string | null;
  floor: number | null;
  totalFloor: number;
  floorDisplay: FloorDisplay;
  roomCount: number | null;
  bathCount: number | null;
  direction: Direction | null;
  directionBase: string | null;
  moveInDate: string | null;
  approvalDate: string | null;
  parkingTotal: number | null;
  parkingPerUnit: string | null;
  buildingUse: string | null;
  maintenanceFee: number | null;
  maintenanceDetail: MaintenanceDetail | null;
  premiumFee: number | null;
  businessTypeCurrent: string | null;
  businessTypeRecommended: string | null;
  sido: string;
  sigungu: string;
  dong: string;
  lat: number;
  lng: number;
  description: string;
  videoUrl: string | null;
  videoDuration: string | null;
  videoSummary: string | null;
  fieldCheckedAt: string | null;
};

export type PropertyDetailImage = { id: number; filePath: string };

/** YouTube URL → 임베드용 영상 ID. 형식이 아니면 null(임베드 생략) */
function extractYouTubeId(videoUrl: string): string | null {
  const match =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/.exec(videoUrl);
  return match?.[1] ?? null;
}

export function dongAddressOf(property: PropertyDetailData): string {
  return `${property.sido} ${property.sigungu} ${property.dong}`;
}

/* ───────────────────────── 블록들 ───────────────────────── */

/** 배지 + 가격 + 제목 + 동 주소 (M4 §2·PC3 우측 가격 요약 공용) */
export function PriceTitleBlock({ property }: { property: PropertyDetailData }) {
  const isCompleted = property.dealProgress === "COMPLETED";
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          {DEAL_TYPE_LABEL[property.dealType]}
        </span>
        <span className="rounded-sm bg-surface-alt px-2 py-0.5 text-xs text-ink-70">
          {BUILDING_TYPE_LABEL[property.buildingType]}
        </span>
        {isCompleted && (
          // 목록 M2 배지와 동일 조합 — 흰 글자/ink-40 배경은 대비 3.6:1로 AA 미달이었다
          <span className="rounded-sm bg-[#F0ECE4] px-2 py-0.5 text-xs font-bold text-ink-70">
            거래완료
          </span>
        )}
        {property.fieldCheckedAt && (
          <span className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink-70">
            현장 확인 {property.fieldCheckedAt}
          </span>
        )}
      </div>
      <p
        className={`num mt-2 text-[32px] font-bold tracking-[-0.02em] ${
          isCompleted ? "text-ink-40 line-through" : "text-price"
        }`}
      >
        {formatPropertyPrice(property)}
      </p>
      {/* 상가 권리금 — 가격 옆이 손님이 가장 먼저 찾는 자리 (미기재 null이면 생략) */}
      {property.premiumFee !== null && (
        <p className="num mt-0.5 text-sm text-ink-70">권리금 {formatPremiumFee(property.premiumFee)}</p>
      )}
      <h1 className="mt-1 text-lg font-bold">{property.title}</h1>
      <p className="text-sm text-ink-70">{dongAddressOf(property)}</p>
    </section>
  );
}

/** 조건 표 8칸 (확정 M4 §3 + PC3 "조건 8칸 스펙표") — columns로 M(2열)·PC(4열=2행) 대응 */
export function SpecGrid({
  property,
  columnsClass = "grid-cols-2",
}: {
  property: PropertyDetailData;
  columnsClass?: string;
}) {
  const specEntries: [string, string][] = [
    ["전용면적", formatArea(property.exclusiveArea)],
    ["공급면적", property.supplyArea ? formatArea(property.supplyArea) : "-"],
    ["층", formatFloor(property)],
    [
      "방향",
      property.direction
        ? `${DIRECTION_LABEL[property.direction]}${property.directionBase ? ` (${property.directionBase} 기준)` : ""}`
        : "-",
    ],
    ["관리비", formatMaintenanceFee(property.maintenanceFee)],
    ["입주가능일", property.moveInDate ?? "-"],
    [
      "주차",
      property.parkingTotal === null
        ? "-"
        : `총 ${property.parkingTotal}대${property.parkingPerUnit ? ` (세대당 ${property.parkingPerUnit})` : ""}`,
    ],
    ["건축물 용도", property.buildingUse ?? "-"],
  ];
  // dt/dd는 dl의 자손이어야 유효한 HTML — dl 자체를 grid 컨테이너로 쓴다
  return (
    <dl
      className={`grid gap-px overflow-hidden rounded-md border border-line bg-line ${columnsClass}`}
    >
      {specEntries.map(([specLabel, specValue]) => (
        <div key={specLabel} className="bg-surface p-3">
          <dt className="text-xs text-ink-70">{specLabel}</dt>
          <dd className="num mt-0.5 text-sm font-medium">{specValue}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 대표 코멘트 — 확정 M4 §4 "대표 사진 + 구어체 코멘트". 내용은 description(다듬지 않는다) */
export function OwnerCommentBlock({
  property,
  officeInfo,
}: {
  property: PropertyDetailData;
  officeInfo: OfficeInfo | null;
}) {
  if (property.description === "") return null;
  return (
    <section className="rounded-[13px] border border-[#EFEAE0] bg-surface p-4">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
        <img
          src="/brand/ohc-profile.jpg"
          alt={officeInfo ? `대표 ${officeInfo.ownerName}` : PROFILE_ALT}
          className="h-9 w-9 flex-none rounded-full object-cover [object-position:50%_22%]"
        />
        <div className="flex flex-col">
          <h2 className="text-sm font-extrabold tracking-[-0.3px] text-ink">
            이 자리에 대한 제 생각
          </h2>
          {officeInfo && (
            <span className="text-[11.5px] text-ink-40">대표 {officeInfo.ownerName}</span>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-70">
        {property.description}
      </p>
    </section>
  );
}

/** 지도 미니뷰 + 동 안내 (확정 M4 §5) */
export function LocationBlock({
  property,
  mapHeightClass = "h-52",
}: {
  property: PropertyDetailData;
  mapHeightClass?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold">위치</h2>
      <div className={`mt-2 overflow-hidden rounded-md border border-line ${mapHeightClass}`}>
        <MiniMapClient
          lat={property.lat}
          lng={property.lng}
          dealType={property.dealType}
          salePrice={property.salePrice}
          deposit={property.deposit}
          monthlyRent={property.monthlyRent}
        />
      </div>
      <p className="mt-1.5 text-sm text-ink-70">
        {dongAddressOf(property)} · 정확한 주소는 문의 시 안내드립니다.
      </p>
    </section>
  );
}

/** 유튜브 임장 영상 (확정 M4 §6 — 지도 아래). 파사드 방식 — 클릭 시에만 임베드 로드 */
export function VideoSection({ property }: { property: PropertyDetailData }) {
  const youTubeId = property.videoUrl ? extractYouTubeId(property.videoUrl) : null;
  if (!youTubeId) return null;
  return (
    <section>
      <h2 className="text-sm font-bold">
        영상으로 둘러보기{property.videoDuration ? ` (${property.videoDuration})` : ""}
      </h2>
      <div className="mt-2">
        <VideoEmbed youTubeId={youTubeId} videoTitle={`${property.title} 영상`} />
      </div>
      {property.videoSummary && <p className="mt-1.5 text-sm text-ink-70">{property.videoSummary}</p>}
    </section>
  );
}

/** 옵션 칩 */
export function OptionsSection({ optionCodes }: { optionCodes: PropertyOption[] }) {
  if (optionCodes.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-bold">옵션</h2>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {optionCodes.map((optionCode) => (
          <li key={optionCode} className="rounded-sm bg-surface-alt px-2 py-1 text-xs text-ink-70">
            {PROPERTY_OPTION_LABEL[optionCode]}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 관리비 3구분 (법정) — 총액은 조건 표에, 구분 내역은 법정 블록 직전에 */
export function MaintenanceDetailSection({ property }: { property: PropertyDetailData }) {
  const maintenanceGroups = property.maintenanceDetail
    ? MAINTENANCE_GROUPS.filter((group) => (property.maintenanceDetail?.[group] ?? []).length > 0)
    : [];
  if (maintenanceGroups.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-bold">
        관리비 <span className="num font-medium text-ink-70">{formatMaintenanceFee(property.maintenanceFee)}</span>
      </h2>
      <dl className="mt-2 flex flex-col gap-2 rounded-md bg-surface-alt p-3 text-sm">
        {maintenanceGroups.map((group) => (
          <div key={group}>
            <dt className="text-xs font-medium text-ink-70">{MAINTENANCE_GROUP_LABEL[group]}</dt>
            {(property.maintenanceDetail?.[group] ?? []).map((maintenanceItem) => (
              <dd key={maintenanceItem.item} className="mt-0.5 flex justify-between">
                <span>{maintenanceItem.item}</span>
                <span className="num">월 {maintenanceItem.amount}만원</span>
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}

function LegalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      {/* 라벨은 ink-70 — ink-40은 대비 3.09:1로 법정 표기에 부적합(WCAG AA) */}
      <th scope="row" className="w-32 py-2 pr-3 text-left align-top font-medium text-ink-70">
        {label}
      </th>
      {/* num: 숫자만 tabular 적용 — 한글에는 영향 없다(§5-3) */}
      <td className="num py-2">{value}</td>
    </tr>
  );
}

/** 법정 명시항목 표 (§8 전부) — PC3에서는 "건축물 · 개발 정보" 카드 자리에 온다 */
export function LegalTable({ property }: { property: PropertyDetailData }) {
  const residential = isResidential(property.buildingType);
  return (
    <section>
      <h2 className="text-sm font-bold">상세 정보 (법정 명시항목)</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          <LegalRow label="소재지" value={dongAddressOf(property)} />
          <LegalRow label="중개대상물 종류" value={BUILDING_TYPE_LABEL[property.buildingType]} />
          <LegalRow label="거래형태" value={DEAL_TYPE_LABEL[property.dealType]} />
          <LegalRow label="전용면적" value={formatArea(property.exclusiveArea)} />
          <LegalRow
            label="공급면적"
            value={property.supplyArea ? formatArea(property.supplyArea) : "-"}
          />
          <LegalRow label="층" value={formatFloor(property)} />
          <LegalRow label="건축물 용도" value={property.buildingUse ?? "-"} />
          <LegalRow
            label="방향"
            value={
              property.direction
                ? `${DIRECTION_LABEL[property.direction]}${property.directionBase ? ` (${property.directionBase} 기준)` : ""}`
                : "-"
            }
          />
          <LegalRow
            label="방 수 / 욕실 수"
            value={
              residential && property.roomCount !== null
                ? `${property.roomCount} / ${property.bathCount ?? "-"}`
                : "-"
            }
          />
          <LegalRow label="입주가능일" value={property.moveInDate ?? "-"} />
          <LegalRow label="행정기관 승인일자" value={property.approvalDate ?? "-"} />
          <LegalRow
            label="주차"
            value={
              property.parkingTotal === null
                ? "-"
                : `총 ${property.parkingTotal}대${property.parkingPerUnit ? ` (세대당 ${property.parkingPerUnit}대)` : ""}`
            }
          />
          <LegalRow label="관리비" value={formatMaintenanceFee(property.maintenanceFee)} />
          {/* 중개보수 안내 — 법정 필수(A3 카드3). 구형 데이터는 null일 수 있어 '-'로 표기 */}
          <LegalRow label="중개보수" value={property.brokerFeeNote ?? "-"} />
          {/* 상가·사무실 전용 — 미기재(null)면 행 자체를 생략한다 */}
          {property.premiumFee !== null && (
            <LegalRow label="권리금" value={formatPremiumFee(property.premiumFee)} />
          )}
          {property.businessTypeCurrent && (
            <LegalRow label="현재업종" value={property.businessTypeCurrent} />
          )}
          {property.businessTypeRecommended && (
            <LegalRow label="추천업종" value={property.businessTypeRecommended} />
          )}
        </tbody>
      </table>
    </section>
  );
}

/** 중개사무소 정보 (법정 — 명칭·소재지·등록번호·성명·연락처 5종) */
export function OfficeInfoCard({ officeInfo }: { officeInfo: OfficeInfo | null }) {
  return (
    <section className="rounded-md bg-surface-alt p-4">
      <h2 className="text-sm font-bold">중개사무소 정보</h2>
      {officeInfo ? (
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          {(
            [
              ["명칭", officeInfo.officeName, false],
              ["소재지", officeInfo.officeAddress, false],
              ["등록번호", officeInfo.registrationNumber, true],
              ["개업공인중개사", officeInfo.ownerName, false],
              ["연락처", officeInfo.officePhone, true],
            ] as const
          ).map(([infoLabel, infoValue, isNumeric]) => (
            <div key={infoLabel} className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-70">{infoLabel}</dt>
              <dd className={isNumeric ? "num" : undefined}>{infoValue}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-ink-70">중개사무소 정보 준비 중</p>
      )}
    </section>
  );
}

/* ───────────────────────── M4 기본 조립 ───────────────────────── */

export function PropertyDetailBody({
  property,
  images,
  optionCodes,
  officeInfo,
}: {
  property: PropertyDetailData;
  images: PropertyDetailImage[];
  optionCodes: PropertyOption[];
  officeInfo: OfficeInfo | null;
}) {
  return (
    <>
      {/* 확정 M4 §1 사진 캐러셀 */}
      <PhotoCarousel images={images} title={property.title} />

      <div className="flex flex-col gap-6 p-4">
        <PriceTitleBlock property={property} />
        <SpecGrid property={property} />
        <OwnerCommentBlock property={property} officeInfo={officeInfo} />
        <LocationBlock property={property} />
        <VideoSection property={property} />
        <OptionsSection optionCodes={optionCodes} />
        <MaintenanceDetailSection property={property} />
        <LegalTable property={property} />
        <OfficeInfoCard officeInfo={officeInfo} />
      </div>
    </>
  );
}
