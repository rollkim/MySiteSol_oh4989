"use client";

import Link from "next/link";
import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { formatArea } from "@/domain/area";
import { MAP_KEYWORD_MAX_LENGTH } from "@/domain/map";
import { formatPropertyPrice } from "@/domain/price";
import {
  BUILDING_TYPE_LABEL,
  BUILDING_TYPES,
  DEAL_TYPE_LABEL,
  DEAL_TYPES,
  type BuildingType,
  type DealType,
  type PropertyDealProgress,
  type PropertyVisibility,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/**
 * A2 매물 관리 — 확정 기획: 필터바 → (선택 시)일괄 띠 → 10컬럼 표.
 * "체크하면 상단에 검은 띠가 뜨고 공개·숨김·거래완료를 한 번에 바꿉니다.
 *  거래완료 매물은 자동으로 목록 맨 뒤로 내려가고 30일 뒤 보관함으로 들어갑니다 — 지우지 않습니다."
 * 삭제 버튼은 두지 않는다(설계원칙 2) — 보관함으로 대체.
 */

/** 상태 배지 확정색 (기획 st()) */
const BADGE_TONE = {
  VISIBLE: { fg: "#146B7C", bg: "#EDF3F1", label: "공개" },
  HIDDEN: { fg: "#7C8990", bg: "#F0ECE4", label: "비공개" },
  COMPLETED: { fg: "#8A6A12", bg: "#FBF3DF", label: "거래완료" },
} as const;

/** 거래유형별 글자색 (기획 dealFg) */
const DEAL_FG: Record<DealType, string> = {
  MONTHLY: "#146B7C",
  SHORT: "#146B7C",
  SALE: "#8A6A12",
  JEONSE: "#5C6B72",
};

/** 확정 10컬럼 — 첫 트랙만 44px(체크박스 터치 타깃 규약) */
const GRID_COLUMNS =
  "grid-cols-[44px_66px_minmax(0,1fr)_74px_66px_132px_84px_62px_84px_88px] items-center px-6";


function FilterChip({
  chipLabel,
  isOn,
  onToggle,
}: {
  chipLabel: string;
  isOn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isOn}
      onClick={onToggle}
      className={`flex h-9 min-h-11 items-center rounded-lg border px-3 text-[12.5px] font-semibold transition-colors ${
        isOn ? "border-[#0B2430] bg-[#0B2430] text-white" : "border-[#D4CFC6] bg-white text-[#3C4C54]"
      }`}
    >
      {chipLabel}
    </button>
  );
}

export default function AdminPropertiesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>([]);
  const [dealTypes, setDealTypes] = useState<DealType[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<"" | PropertyVisibility>("");
  const [progressFilter, setProgressFilter] = useState<"" | PropertyDealProgress>("");
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const propertyList = useQuery(
    trpc.admin.property.list.queryOptions({
      keyword: keyword || undefined,
      buildingTypes: buildingTypes.length ? buildingTypes : undefined,
      dealTypes: dealTypes.length ? dealTypes : undefined,
      listingVisibility: visibilityFilter || undefined,
      dealProgress: progressFilter || undefined,
      archivedOnly,
    }),
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.admin.property.list.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.admin.dashboard.summary.queryKey() });
    setSelectedIds([]);
  };
  const bulkAction = useMutation(
    trpc.admin.property.bulkAction.mutationOptions({ onSuccess: invalidateAll }),
  );
  const renewExposure = useMutation(
    trpc.admin.property.renewExposure.mutationOptions({ onSuccess: invalidateAll }),
  );

  const rows = propertyList.data?.items ?? [];
  const counts = propertyList.data?.counts;
  /* 필터를 바꾸면 화면에서 사라진 매물이 선택에 남는다 — 일괄 처리는 **보이는 것만** 대상으로 한다.
     핸들러마다 초기화를 넣는 방식은 필터가 늘 때 또 빠뜨린다(리뷰 확정 major). */
  const selectedIdSet = new Set(selectedIds);
  const visibleSelectedIds = rows.filter((row) => selectedIdSet.has(row.id)).map((row) => row.id);
  const allChecked = rows.length > 0 && rows.every((row) => selectedIdSet.has(row.id));

  const toggleRow = (propertyId: number) =>
    setSelectedIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  const toggleBuildingType = (buildingType: BuildingType) =>
    setBuildingTypes((current) =>
      current.includes(buildingType)
        ? current.filter((code) => code !== buildingType)
        : [...current, buildingType],
    );
  const toggleDealType = (dealType: DealType) =>
    setDealTypes((current) =>
      current.includes(dealType) ? current.filter((code) => code !== dealType) : [...current, dealType],
    );

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5DFD4] bg-white">
      {/* 요약 + 보관함 탭 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E5DFD4] px-6 py-3">
        <p className="num text-[12.5px] text-[#7C8990]">
          전체 {counts?.totalCount ?? 0}건 · 공개 {counts?.visibleCount ?? 0} · 비공개{" "}
          {counts?.hiddenCount ?? 0}
        </p>
        <div className="ml-auto flex gap-1.5">
          <FilterChip
            chipLabel="운영 중"
            isOn={!archivedOnly}
            onToggle={() => {
              setArchivedOnly(false);
              setSelectedIds([]);
            }}
          />
          <FilterChip
            chipLabel={`보관함 ${counts?.archivedCount ?? 0}`}
            isOn={archivedOnly}
            onToggle={() => {
              setArchivedOnly(true);
              setSelectedIds([]);
            }}
          />
        </div>
      </div>

      {/* 필터바 */}
      <div className="flex flex-wrap items-center gap-[9px] border-b border-[#E5DFD4] px-6 py-3">
        <form
          className="flex h-11 w-[250px] items-center gap-2 rounded-lg border-[1.5px] border-[#0B2430] px-3 focus-within:ring-2 focus-within:ring-accent"
          onSubmit={(event) => {
            event.preventDefault();
            setKeyword(keywordDraft.trim().slice(0, MAP_KEYWORD_MAX_LENGTH));
            setSelectedIds([]);
          }}
        >
          <Search size={13} className="flex-none text-[#0B2430]" aria-hidden />
          <input
            type="search"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            maxLength={MAP_KEYWORD_MAX_LENGTH}
            placeholder="매물명 · 주소 · 관리번호"
            aria-label="매물 검색"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold text-[#0B2430] outline-none placeholder:text-[#A79E90]"
          />
        </form>

        <div role="group" aria-label="종류 필터" className="flex flex-wrap gap-1.5">
          {/* 관리자는 10종 전부 — 공개면 그룹 칩(3종)과 노출 기준이 다르다 */}
          {BUILDING_TYPES.map((buildingType) => (
            <FilterChip
              key={buildingType}
              chipLabel={BUILDING_TYPE_LABEL[buildingType]}
              isOn={buildingTypes.includes(buildingType)}
              onToggle={() => toggleBuildingType(buildingType)}
            />
          ))}
        </div>
        <div role="group" aria-label="거래유형 필터" className="flex flex-wrap gap-1.5">
          {DEAL_TYPES.map((dealType) => (
            <FilterChip
              key={dealType}
              chipLabel={DEAL_TYPE_LABEL[dealType]}
              isOn={dealTypes.includes(dealType)}
              onToggle={() => toggleDealType(dealType)}
            />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5C6B72]">
          <span className="sr-only">공개 상태</span>
          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as "" | PropertyVisibility)}
            className="h-11 rounded-lg border border-[#D4CFC6] bg-white px-2 text-[12.5px] font-semibold"
          >
            <option value="">공개 상태 전체</option>
            <option value="VISIBLE">공개</option>
            <option value="HIDDEN">비공개</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5C6B72]">
          <span className="sr-only">거래 진행</span>
          <select
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value as "" | PropertyDealProgress)}
            className="h-11 rounded-lg border border-[#D4CFC6] bg-white px-2 text-[12.5px] font-semibold"
          >
            <option value="">거래 진행 전체</option>
            <option value="AVAILABLE">거래중</option>
            <option value="UNDER_CONTRACT">계약중</option>
            <option value="COMPLETED">거래완료</option>
          </select>
        </label>
      </div>

      {/* 일괄 선택 띠 — 확정 #0B2430. 카운트·대상 모두 화면에 보이는 선택분만 */}
      {visibleSelectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-[11px] bg-[#0B2430] px-6 py-2.5">
          <span className="num text-[12.5px] font-bold text-white">
            {visibleSelectedIds.length}건 선택됨
          </span>
          <div className="flex flex-wrap gap-[7px]">
            <button
              type="button"
              disabled={bulkAction.isPending}
              onClick={() => bulkAction.mutate({ propertyIds: visibleSelectedIds, action: "PUBLISH" })}
              className="flex h-11 items-center rounded-md border border-[#E8C87A] bg-[#E8C87A] px-3 text-[11.5px] font-bold text-[#0B2430] disabled:opacity-60"
            >
              공개
            </button>
            <button
              type="button"
              disabled={bulkAction.isPending}
              onClick={() => bulkAction.mutate({ propertyIds: visibleSelectedIds, action: "HIDE" })}
              className="flex h-11 items-center rounded-md border border-white/30 px-3 text-[11.5px] font-bold text-[#CFE0E6] disabled:opacity-60"
            >
              숨김
            </button>
            <button
              type="button"
              disabled={bulkAction.isPending}
              onClick={() => bulkAction.mutate({ propertyIds: visibleSelectedIds, action: "COMPLETE" })}
              className="flex h-11 items-center rounded-md border border-white/30 px-3 text-[11.5px] font-bold text-[#CFE0E6] disabled:opacity-60"
            >
              거래완료로
            </button>
            <button
              type="button"
              disabled={bulkAction.isPending}
              onClick={() =>
                bulkAction.mutate({
                  propertyIds: visibleSelectedIds,
                  action: archivedOnly ? "UNARCHIVE" : "ARCHIVE",
                })
              }
              className="flex h-11 items-center rounded-md border border-white/30 px-3 text-[11.5px] font-bold text-[#CFE0E6] disabled:opacity-60"
            >
              {archivedOnly ? "보관 해제" : "보관함"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ml-auto flex h-11 items-center text-[11.5px] font-semibold text-[#9FB3BC]"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 일괄 처리 결과 — 법정 요건 미비로 막힌 건은 사유를 보여준다 */}
      {bulkAction.data && bulkAction.data.failures.length > 0 && (
        <div role="alert" className="border-b border-[#F3D9D3] bg-[#FBEDEA] px-6 py-3">
          <p className="text-[12.5px] font-bold text-[#8E2D22]">
            {bulkAction.data.successCount}건 처리 · {bulkAction.data.failures.length}건 실패
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {bulkAction.data.failures.map((failure) => (
              <li key={failure.propertyId} className="text-[11.5px] text-[#8E2D22]">
                #{failure.propertyId} — {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bulkAction.isError && (
        <p role="alert" className="border-b border-[#F3D9D3] bg-[#FBEDEA] px-6 py-3 text-[12.5px] text-[#8E2D22]">
          {bulkAction.error.message}
        </p>
      )}

      {/* 표 헤더 */}
      <div
        className={`hidden h-10 border-b border-[#E5DFD4] bg-[#FAF8F4] text-[11.5px] font-bold text-[#7C8990] min-[1100px]:grid ${GRID_COLUMNS}`}
      >
        <span className="flex min-h-11 items-center">
          <input
            type="checkbox"
            aria-label="전체 선택"
            checked={allChecked}
            onChange={() => setSelectedIds(allChecked ? [] : rows.map((row) => row.id))}
            className="size-4 accent-[#146B7C]"
          />
        </span>
        <span>사진</span>
        <span>매물명 · 주소</span>
        <span>종류</span>
        <span>거래</span>
        <span>금액</span>
        <span>전용</span>
        <span className="text-right">조회</span>
        <span>상태</span>
        <span />
      </div>

      {propertyList.isPending && <p className="px-6 py-8 text-sm text-[#96A1A7]">불러오는 중…</p>}
      {propertyList.isError && (
        <p role="alert" className="px-6 py-8 text-sm text-[#C0392B]">
          목록을 불러오지 못했습니다: {propertyList.error.message}
        </p>
      )}
      {propertyList.isSuccess && rows.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-[#7C8990]">
          {archivedOnly ? "보관함이 비어 있습니다." : "조건에 맞는 매물이 없습니다."}
        </p>
      )}

      {/* 표 본문 — 좁은 화면에서는 카드형으로 흐른다 */}
      <ul>
        {rows.map((property) => {
          const isSelected = selectedIds.includes(property.id);
          const badge =
            property.dealProgress === "COMPLETED"
              ? BADGE_TONE.COMPLETED
              : BADGE_TONE[property.listingVisibility];
          return (
            <li
              key={property.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0ECE4] px-6 py-3 last:border-b-0 min-[1100px]:grid min-[1100px]:h-[62px] min-[1100px]:gap-0 min-[1100px]:py-0 ${GRID_COLUMNS} ${
                isSelected ? "bg-[#F6FAF9]" : "bg-white"
              }`}
            >
              {/* 히트 영역 44px — 시각 크기는 16px 유지(라벨로 감싸 클릭 범위만 확장) */}
              <label className="flex min-h-11 min-w-11 cursor-pointer items-center">
                <input
                  type="checkbox"
                  aria-label={`${property.title} 선택`}
                  checked={isSelected}
                  onChange={() => toggleRow(property.id)}
                  className="size-4 accent-[#146B7C]"
                />
              </label>
              <span className="block h-10 w-[52px] overflow-hidden rounded-md bg-[#EFEAE0]">
                {property.thumbPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
                  <img
                    src={`/uploads/${property.thumbPath}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[9px] text-[#A79E90]">
                    없음
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 pr-3.5">
                <Link
                  href={`/admin/properties/${property.id}/edit`}
                  className="truncate text-[13px] font-bold text-[#0B2430] hover:underline"
                >
                  {property.title}
                </Link>
                <span className="truncate text-[11.5px] text-[#7C8990]">
                  {property.roadAddress ?? property.jibunAddress}
                  {property.listingCode ? ` · ${property.listingCode}` : ""}
                </span>
              </span>
              <span className="text-[12.5px] font-semibold text-[#3C4C54]">
                {BUILDING_TYPE_LABEL[property.buildingType]}
              </span>
              <span
                className="text-[12.5px] font-bold"
                style={{ color: DEAL_FG[property.dealType] }}
              >
                {DEAL_TYPE_LABEL[property.dealType]}
              </span>
              <span className="num text-[13px] font-extrabold text-[#0B2430]">
                {property.priceNegotiable ? "가격 협의" : formatPropertyPrice(property)}
              </span>
              <span className="num text-[12.5px] font-semibold text-[#3C4C54]">
                {formatArea(property.exclusiveArea)}
              </span>
              {/* 카드로 흐르는 좁은 화면에서는 표 헤더가 없으므로 값 앞에 라벨을 붙인다 */}
              <span className="num pr-3 text-[12.5px] font-semibold text-[#7C8990] min-[1100px]:text-right">
                <span className="min-[1100px]:hidden">조회 </span>
                {property.viewCount}
              </span>
              <span>
                {/* 색 + 텍스트 병행 (RULE-11) */}
                <span
                  className="inline-flex rounded-[5px] px-[9px] py-1 text-[11.5px] font-bold"
                  style={{ color: badge.fg, background: badge.bg }}
                >
                  {badge.label}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 min-[1100px]:justify-end">
                {/* 노출 만료 임박 행에만 연장 — A1 KPI를 실제로 0으로 되돌릴 수 있는 유일한 경로 */}
                {property.listingVisibility === "VISIBLE" &&
                  property.dealProgress !== "COMPLETED" &&
                  property.isExposureExpiring && (
                    <button
                      type="button"
                      disabled={renewExposure.isPending}
                      onClick={() => renewExposure.mutate({ propertyId: property.id })}
                      title="가격이 그대로인지 확인했다면 노출을 연장합니다"
                      className="inline-flex min-h-11 items-center rounded-md border border-[#F0E3C4] bg-[#FDFAF2] px-2 text-xs font-bold text-[#8A6A12]"
                    >
                      연장
                    </button>
                  )}
                <Link
                  href={`/admin/properties/${property.id}/edit`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[#146B7C]"
                >
                  수정
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
