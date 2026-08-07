"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Map as MapIcon, Search } from "lucide-react";

import { clearMapSnapshotAppliedSearch } from "@/components/map/map-snapshot";
import { DEAL_COLOR } from "@/components/map/price-tag-marker";
import { formatArea } from "@/domain/area";
import { formatFloor } from "@/domain/floor";
import { MAP_KEYWORD_MAX_LENGTH } from "@/domain/map";
import { formatPropertyPrice } from "@/domain/price";
import {
  BUILDING_GROUP_CHIPS,
  BUILDING_TYPE_LABEL,
  BUILDING_TYPES,
  DEAL_TYPE_LABEL,
  DEAL_TYPES,
  PROPERTY_LIST_SORT_LABEL,
  PROPERTY_LIST_SORTS,
  type BuildingType,
  type DealType,
  type FloorDisplay,
  type PropertyListSort,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/**
 * 매물 목록 — 확정안 M2 (검색바 + 필터 칩 + 정렬/총 건수 + 세로 카드 + 무한 스크롤).
 * 필터는 지도와 같은 URL 문법(bt/dt/kw)을 읽고 쓰므로 「◎ 지도」 토글이
 * 같은 검색 조건을 그대로 들고 넘어간다(확정안 "목록 ↔ 지도 토글" 규칙).
 */

type ListItem = {
  id: number;
  title: string;
  dealType: DealType;
  buildingType: BuildingType;
  dealProgress: string;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: string;
  floor: number | null;
  totalFloor: number;
  floorDisplay: FloorDisplay;
  dong: string;
  thumbPath: string | null;
};

function ListRow({ property }: { property: ListItem }) {
  const isCompleted = property.dealProgress === "COMPLETED";
  const dealColor = DEAL_COLOR[property.dealType];
  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex items-start gap-3 border-b border-[#F0ECE4] px-[18px] py-3.5 transition-colors hover:bg-surface-alt"
    >
      <span className="relative block h-[88px] w-28 flex-none overflow-hidden rounded-[9px] bg-[#E7E2D9]">
        {property.thumbPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
          <img
            src={`/uploads/${property.thumbPath}`}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${isCompleted ? "opacity-60" : ""}`}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[9.5px] font-semibold text-[#A79E90]">
            사진 준비 중
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span
          className={`truncate text-sm font-extrabold tracking-[-0.3px] ${
            isCompleted ? "text-ink-40 line-through" : "text-ink"
          }`}
        >
          {property.title}
        </span>
        <span
          className={`num text-[15px] leading-tight font-extrabold tracking-[-0.4px] ${
            isCompleted ? "text-ink-40 line-through" : "text-accent"
          }`}
        >
          {formatPropertyPrice(property)}
        </span>
        <span className="num truncate text-[11.5px] font-medium text-ink-40">
          {formatArea(property.exclusiveArea)} · {formatFloor(property)} · {property.dong}
        </span>
        <span className="flex items-center gap-1 pt-0.5">
          {/* 거래완료 = 색 + 텍스트 + 취소선 (색만으로 구분 금지, RULE-11) */}
          {isCompleted && (
            <span className="rounded-[4px] bg-[#F0ECE4] px-[5px] py-[3px] text-[10px] leading-none font-bold text-ink-70">
              거래완료
            </span>
          )}
          <span
            className="rounded-[4px] px-[5px] py-[3px] text-[10px] leading-none font-bold"
            style={{ color: dealColor.fg, background: dealColor.bg }}
          >
            {DEAL_TYPE_LABEL[property.dealType]}
          </span>
          <span className="text-[11px] font-semibold text-ink-40">
            {BUILDING_TYPE_LABEL[property.buildingType]}
          </span>
        </span>
      </span>
    </Link>
  );
}

function parseCodes<Code extends string>(
  rawValue: string | null,
  validCodes: readonly Code[],
): Code[] {
  if (!rawValue) return [];
  return rawValue
    .split(",")
    .filter((code): code is Code => (validCodes as readonly string[]).includes(code));
}

export function ListScreen() {
  const searchParams = useSearchParams();
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>(() =>
    parseCodes(searchParams.get("bt"), BUILDING_TYPES),
  );
  const [dealTypes, setDealTypes] = useState<DealType[]>(() =>
    parseCodes(searchParams.get("dt"), DEAL_TYPES),
  );
  const [keywordDraft, setKeywordDraft] = useState(
    () => searchParams.get("kw")?.trim().slice(0, MAP_KEYWORD_MAX_LENGTH) ?? "",
  );
  const [keyword, setKeyword] = useState(keywordDraft);
  const [listSort, setListSort] = useState<PropertyListSort>(() => {
    const rawSort = searchParams.get("sort");
    return (PROPERTY_LIST_SORTS as readonly string[]).includes(rawSort ?? "")
      ? (rawSort as PropertyListSort)
      : "LATEST";
  });

  /* ── 상태 → URL: 공유·새로고침·뒤로가기가 같은 조건을 본다. sort는 목록 전용 키 ── */
  const listQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (buildingTypes.length) params.set("bt", buildingTypes.join(","));
    if (dealTypes.length) params.set("dt", dealTypes.join(","));
    if (keyword) params.set("kw", keyword);
    if (listSort !== "LATEST") params.set("sort", listSort);
    return params.toString();
  }, [buildingTypes, dealTypes, keyword, listSort]);

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      listQueryString ? `/properties?${listQueryString}` : "/properties",
    );
  }, [listQueryString]);

  /* ── URL → 상태: 동일 세그먼트 재내비게이션(탭 재탭·외부 링크) — "렌더 중 상태 조정".
     자기가 replaceState로 쓴 변화는 파싱 결과가 현재 상태와 같아 값 비교에서 걸러진다
     (특히 keywordDraft — 입력 중 초안을 지우지 않기 위한 가드) ── */
  const [appliedSearch, setAppliedSearch] = useState(() => searchParams.toString());
  const rawSearch = searchParams.toString();
  if (rawSearch !== appliedSearch) {
    setAppliedSearch(rawSearch);
    const params = new URLSearchParams(rawSearch);
    const nextBuildingTypes = parseCodes(params.get("bt"), BUILDING_TYPES);
    if (nextBuildingTypes.join(",") !== buildingTypes.join(",")) {
      setBuildingTypes(nextBuildingTypes);
    }
    const nextDealTypes = parseCodes(params.get("dt"), DEAL_TYPES);
    if (nextDealTypes.join(",") !== dealTypes.join(",")) setDealTypes(nextDealTypes);
    const nextKeyword = params.get("kw")?.trim().slice(0, MAP_KEYWORD_MAX_LENGTH) ?? "";
    if (nextKeyword !== keyword) {
      setKeyword(nextKeyword);
      setKeywordDraft(nextKeyword);
    }
    const rawSort = params.get("sort");
    const nextSort = (PROPERTY_LIST_SORTS as readonly string[]).includes(rawSort ?? "")
      ? (rawSort as PropertyListSort)
      : "LATEST";
    if (nextSort !== listSort) setListSort(nextSort);
  }

  // 지도 토글 — 항상 bt/dt/kw 키를 명시한다(빈 값=해제). 키를 빼먹으면 지도가
  // 자기 스냅샷 필터를 복원해 "같은 검색 조건 유지"(확정안)가 깨진다.
  const mapHref = `/map?bt=${buildingTypes.join(",")}&dt=${dealTypes.join(",")}&kw=${encodeURIComponent(keyword)}`;

  /* ── 데이터 ── */
  const trpc = useTRPC();
  const listQuery = useInfiniteQuery(
    trpc.property.list.infiniteQueryOptions(
      {
        buildingTypes: buildingTypes.length ? buildingTypes : undefined,
        dealTypes: dealTypes.length ? dealTypes : undefined,
        keyword: keyword || undefined,
        sort: listSort,
      },
      {
        // initialCursor를 안 주면 initialPageParam이 undefined가 되어 쿼리가 영구 pending이 된다
        // (@trpc/tanstack-react-query infiniteQueryOptions 구현 실측)
        initialCursor: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        placeholderData: keepPreviousData,
      },
    ),
  );
  const listItems = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = listQuery.data?.pages[0]?.totalCount ?? null;

  /* ── 무한 스크롤 센티널 — 에러 상태에선 붙이지 않는다(실패 시 무한 재시도 루프 방지,
     재개는 '다시 시도' 버튼의 refetch 성공이 담당) ── */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError: isListError } = listQuery;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isListError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isListError]);

  const toggleBuildingGroup = (groupTypes: BuildingType[]) => {
    setBuildingTypes((current) => {
      const isOn = groupTypes.every((buildingType) => current.includes(buildingType));
      return isOn
        ? current.filter((buildingType) => !groupTypes.includes(buildingType))
        : [...new Set([...current, ...groupTypes])];
    });
  };
  const toggleDealType = (dealType: DealType) => {
    setDealTypes((current) =>
      current.includes(dealType)
        ? current.filter((code) => code !== dealType)
        : [...current, dealType],
    );
  };

  // 시안 M2는 칩 32px이지만 RULE-11(터치 타깃 44px)이 우선 — 지도 화면과 같은 판례(min-h-11)
  const chipClass = (isOn: boolean) =>
    `flex min-h-11 flex-none items-center rounded-2xl border px-3 text-[12.5px] font-semibold transition-colors ${
      isOn ? "border-ink bg-ink text-white" : "border-line bg-surface text-[#5C6B72]"
    }`;

  return (
    <section className="flex min-h-[60dvh] flex-col">
      {/* ── 상단 고정: 검색바 + 지도 토글 + 필터 칩 (확정안 M2) ── */}
      <div className="sticky top-0 z-10 flex flex-col gap-[11px] border-b border-[#F0ECE4] bg-surface px-[18px] pt-2.5 pb-2.5">
        <div className="flex gap-2">
          <form
            className="flex h-11 flex-1 items-center gap-2 rounded-[10px] bg-[#F5F2EC] px-3 focus-within:ring-2 focus-within:ring-accent"
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(keywordDraft.trim().slice(0, MAP_KEYWORD_MAX_LENGTH));
            }}
          >
            <Search size={14} className="flex-none text-[#5C6B72]" aria-hidden />
            <input
              type="search"
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              maxLength={MAP_KEYWORD_MAX_LENGTH}
              placeholder="건물명 · 단지 검색"
              aria-label="건물명·단지 검색"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:font-medium placeholder:text-[#A79E90]"
            />
            {(keywordDraft || keyword) && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => {
                  setKeyword("");
                  setKeywordDraft("");
                }}
                className="flex size-11 flex-none items-center justify-center text-ink-40"
              >
                ✕
              </button>
            )}
          </form>
          <Link
            href={mapHref}
            onClick={clearMapSnapshotAppliedSearch}
            className="flex h-11 flex-none items-center gap-[5px] rounded-[10px] bg-ink px-3 text-[13px] font-bold text-white"
          >
            <MapIcon size={14} strokeWidth={2.2} aria-hidden />
            지도
          </Link>
        </div>
        <div
          role="group"
          aria-label="매물 필터"
          className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] py-1 [scrollbar-width:none]"
        >
          {BUILDING_GROUP_CHIPS.map((group) => {
            const isOn = group.types.every((buildingType) => buildingTypes.includes(buildingType));
            return (
              <button
                key={group.label}
                type="button"
                aria-pressed={isOn}
                onClick={() => toggleBuildingGroup(group.types)}
                className={chipClass(isOn)}
              >
                {group.label}
              </button>
            );
          })}
          {DEAL_TYPES.map((dealType) => {
            const isOn = dealTypes.includes(dealType);
            return (
              <button
                key={dealType}
                type="button"
                aria-pressed={isOn}
                onClick={() => toggleDealType(dealType)}
                className={chipClass(isOn)}
              >
                {DEAL_TYPE_LABEL[dealType]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 총 건수 + 정렬 ── */}
      <div className="flex items-center justify-between px-[18px] pt-[5px] pb-[3px]">
        <p className="text-[13px] font-bold text-ink" aria-live="polite">
          매물{" "}
          <span className="num text-accent">
            {listQuery.isPlaceholderData ? "…" : (totalCount ?? "…")}
          </span>
          건
        </p>
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-70">
          <span className="sr-only">정렬</span>
          <select
            value={listSort}
            onChange={(event) => setListSort(event.target.value as PropertyListSort)}
            className="h-11 rounded-lg border border-line bg-surface px-2 text-[12.5px] font-semibold text-ink-70"
          >
            {PROPERTY_LIST_SORTS.map((sortCode) => (
              <option key={sortCode} value={sortCode}>
                {PROPERTY_LIST_SORT_LABEL[sortCode]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── 리스트 ── */}
      {listQuery.isPending && (
        <p className="px-[18px] py-10 text-center text-sm text-ink-40">불러오는 중…</p>
      )}
      {listQuery.isError && (
        <div className="flex flex-col items-center gap-3 px-[18px] py-10">
          <p className="text-sm text-ink-70">목록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="flex h-11 items-center rounded-[10px] border border-ink px-5 text-sm font-bold text-ink"
          >
            다시 시도
          </button>
        </div>
      )}
      {listQuery.isSuccess && listItems.length === 0 && (
        <div className="px-[18px] py-8">
          <p className="rounded-xl border border-dashed border-[#D4CFC6] bg-[#FBFAF7] px-4 py-5 text-[12.5px] leading-[1.6] text-ink-70">
            조건에 맞는 매물이 아직 없습니다.
            <br />
            칩을 풀어 보시거나, 전화 주시면 나와 있는 자리부터 안내드릴게요.
          </p>
        </div>
      )}
      {/* 필터·정렬 전환 중에는 이전 결과를 흐리게 유지 — 빈 화면 깜빡임 없이 진행을 알린다 */}
      <div
        className={`transition-opacity duration-150 ${
          listQuery.isPlaceholderData ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {listItems.map((property) => (
          <ListRow key={property.id} property={property} />
        ))}
      </div>
      {isFetchingNextPage && (
        <p className="py-4 text-center text-xs text-ink-40">더 불러오는 중…</p>
      )}
      <div ref={sentinelRef} aria-hidden />
    </section>
  );
}
