"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MAP_INITIAL_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_KEYWORD_MAX_LENGTH,
  MAP_REGIONS,
} from "@/domain/map";
import {
  BUILDING_GROUP_CHIPS,
  BUILDING_TYPES,
  DEAL_TYPE_LABEL,
  DEAL_TYPES,
  type BuildingType,
  type DealType,
} from "@/lib/codes";
import { MAP_SNAPSHOT_KEY as SNAPSHOT_KEY } from "@/components/map/map-snapshot";
import type { OfficeInfo } from "@/server/services/site-settings.service";
import { useTRPC } from "@/trpc/client";

import { MapCard } from "./MapCard";
import { MapView, type MapCommand, type MapDongDatum, type MapViewport } from "./MapView";

/**
 * 지도 검색 화면 — 확정 시안(baegot-map.html · README M3/PC2) 기준.
 *  - 모바일: 지도 전면 + 검색바·[목록] 토글 + 필터 칩 + 바텀시트(peek 112px / half 48% 가로
 *    카드 레일 / full 88% 세로 리스트) + 현위치 FAB. 마커 탭 → half 레일의 카드 센터링.
 *  - PC: [조건 패널 296px | 목록 | 지도] 3분할. 검색란이 패널 맨 위(의뢰인 지시).
 *  - 카드 클릭 = 선택(핀 하이라이트·지도 이동), **선택된 카드 재클릭 = 상세 이동**.
 *  - 이동 시 idle 디바운스 자동 재검색, 상태는 sessionStorage로 복원.
 */


type SheetState = "peek" | "half" | "full";

type MapSnapshot = {
  center: { lat: number; lng: number };
  zoom: number;
  dealTypes: DealType[];
  buildingTypes: BuildingType[];
  keyword: string;
  selectedId: number | null;
  sheet: SheetState;
  seenIds?: number[];
  /** 마지막으로 적용한 딥링크 쿼리 원문 — 뒤로가기·새로고침 때 같은 딥링크가 스냅샷을 덮지 않게 한다 */
  appliedSearch?: string;
};

function readSnapshot(): MapSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as MapSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * URL 딥링크 — 홈(M1/PC1)의 타일·검색이 지도로 넘어오는 통로.
 * `?bt=STORE,APT&dt=MONTHLY&kw=아브뉴프랑&rg=배곧동&sheet=full`
 * **지정된 키만** sessionStorage 스냅샷보다 우선하며, 스냅샷의 appliedSearch와
 * 같은 쿼리는 재적용하지 않는다(뒤로가기·새로고침에서 사용자의 최신 상태 보존).
 * ⚠️ window.location이 아니라 useSearchParams 값으로 파싱해야 한다 — 클라이언트
 * 내비게이션에서 pushState는 커밋 단계라, 렌더 중 location은 아직 이전 URL이다.
 */
type MapDeepLink = {
  dealTypes?: DealType[];
  buildingTypes?: BuildingType[];
  keyword?: string;
  regionCenter?: { lat: number; lng: number };
  sheet?: SheetState;
};

function parseDeepLink(params: URLSearchParams): MapDeepLink | null {
  const deepLink: MapDeepLink = {};
  // 키가 존재하면 빈 값도 "명시적 해제"로 해석한다 — 목록(M2) 토글이 '조건 없음'을
  // 전달하는 통로. 키 자체가 없으면(홈 타일 등) 그 축은 스냅샷과 병합한다.
  if (params.has("bt")) {
    deepLink.buildingTypes = (params.get("bt") ?? "")
      .split(",")
      .filter((code): code is BuildingType => (BUILDING_TYPES as readonly string[]).includes(code));
  }
  if (params.has("dt")) {
    deepLink.dealTypes = (params.get("dt") ?? "")
      .split(",")
      .filter((code): code is DealType => (DEAL_TYPES as readonly string[]).includes(code));
  }
  if (params.has("kw")) {
    deepLink.keyword = (params.get("kw") ?? "").trim().slice(0, MAP_KEYWORD_MAX_LENGTH);
  }
  const region = MAP_REGIONS.find((candidate) => candidate.label === params.get("rg"));
  if (region) deepLink.regionCenter = { lat: region.lat, lng: region.lng };
  const sheet = params.get("sheet");
  if (sheet === "peek" || sheet === "half" || sheet === "full") deepLink.sheet = sheet;
  return Object.keys(deepLink).length ? deepLink : null;
}

/** 바텀시트 3단 스냅 — 확정값(README M3): peek 112px / half 48% / full 88% */
const SHEET_PEEK_PX = 112;
const SHEET_HALF_RATIO = 0.52; // translateY 52% = 시트가 48% 노출
const SHEET_FULL_RATIO = 0.12; // 12% 남김 = 88% 노출

/** 건물유형 그룹 칩 — 시안 M2 빠른 진입 분류(주력 상권 기준) */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches,
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 900px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return isDesktop;
}

/** 전 페이지 법정 표기(§8) — 지도 화면용 미니 표기 */
function OfficeLegalLine({ officeInfo }: { officeInfo: OfficeInfo | null | undefined }) {
  if (!officeInfo) return null;
  return (
    <p className="border-t border-line bg-surface-alt px-3 py-2 text-[11px] leading-[1.7] text-ink-70">
      {officeInfo.officeName} · {officeInfo.officeAddress} · 등록번호{" "}
      <span className="num">{officeInfo.registrationNumber}</span> · 개업공인중개사{" "}
      {officeInfo.ownerName} · ☎ <span className="num">{officeInfo.officePhone}</span>
    </p>
  );
}

export function MapScreen() {
  const trpc = useTRPC();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const searchParams = useSearchParams();
  const [snapshot] = useState<MapSnapshot | null>(() => readSnapshot());
  const [deepLink] = useState<MapDeepLink | null>(() => {
    const rawSearch = searchParams.toString();
    if (!rawSearch || snapshot?.appliedSearch === rawSearch) return null;
    return parseDeepLink(new URLSearchParams(rawSearch));
  });
  // 스냅샷에 기록할 "적용된 딥링크" 원문 — 이번에 적용했으면 현재 쿼리, 아니면 이전 기록 유지
  const [appliedSearch, setAppliedSearch] = useState(() =>
    deepLink ? searchParams.toString() : (snapshot?.appliedSearch ?? ""),
  );

  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [dealTypes, setDealTypes] = useState<DealType[]>(
    deepLink?.dealTypes ?? snapshot?.dealTypes ?? [],
  );
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>(
    deepLink?.buildingTypes ?? snapshot?.buildingTypes ?? [],
  );
  const [keywordDraft, setKeywordDraft] = useState(deepLink?.keyword ?? snapshot?.keyword ?? "");
  const [keyword, setKeyword] = useState(deepLink?.keyword ?? snapshot?.keyword ?? "");
  const [selectedId, setSelectedId] = useState<number | null>(snapshot?.selectedId ?? null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>(
    deepLink?.sheet ?? snapshot?.sheet ?? "peek",
  );
  const [seenIds, setSeenIds] = useState<ReadonlySet<number>>(
    () => new Set(snapshot?.seenIds ?? []),
  );
  const mapCommandRef = useRef<MapCommand | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const markSeen = useCallback((propertyId: number) => {
    setSeenIds((current) => {
      if (current.has(propertyId)) return current;
      const next = new Set(current);
      next.add(propertyId);
      return next;
    });
  }, []);

  /* ── 검색 ── */
  const mapSearch = useQuery(
    trpc.property.mapSearch.queryOptions(
      viewport
        ? {
            bounds: viewport.bounds,
            zoom: viewport.zoom,
            dealTypes: dealTypes.length > 0 ? dealTypes : undefined,
            buildingTypes: buildingTypes.length > 0 ? buildingTypes : undefined,
            keyword: keyword || undefined,
          }
        : { bounds: { sw: { lat: 37, lng: 126 }, ne: { lat: 38, lng: 127 } }, zoom: 15 },
      {
        enabled: viewport !== null,
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        gcTime: 60_000,
      },
    ),
  );
  const officeInfo = useQuery(
    trpc.siteSetting.officeInfo.queryOptions(undefined, { staleTime: Infinity }),
  );

  const markers = useMemo(
    () => (mapSearch.data?.mode === "markers" ? mapSearch.data.markers : []),
    [mapSearch.data],
  );
  const dongGroups = useMemo(
    () => (mapSearch.data?.mode === "dong" ? mapSearch.data.dongGroups : []),
    [mapSearch.data],
  );
  const truncated = mapSearch.data?.mode === "markers" && mapSearch.data.truncated;
  const totalVisible =
    mapSearch.data?.mode === "dong"
      ? dongGroups.reduce((sum, dongDatum) => sum + dongDatum.propertyCount, 0)
      : (mapSearch.data?.mode === "markers" ? mapSearch.data.totalCount : markers.length);

  /* ── 스냅샷 저장 ── */
  useEffect(() => {
    if (!viewport) return;
    const nextSnapshot: MapSnapshot = {
      center: viewport.center,
      zoom: viewport.zoom,
      dealTypes,
      buildingTypes,
      keyword,
      selectedId,
      sheet: sheetState,
      seenIds: [...seenIds].slice(-200),
      appliedSearch: appliedSearch || undefined,
    };
    try {
      window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
    } catch {
      /* 저장 실패는 치명적이지 않다 */
    }
  }, [viewport, dealTypes, buildingTypes, keyword, selectedId, sheetState, seenIds, appliedSearch]);

  /* ── 동일 세그먼트 딥링크 — /map에 머문 채 쿼리만 바뀌면(헤더 GNB 등) 리마운트가 없으므로
     "렌더 중 상태 조정" 패턴으로 지정된 키만 재적용한다 (비교 가드가 무한 루프를 막는다) ── */
  const rawSearch = searchParams.toString();
  if (rawSearch && rawSearch !== appliedSearch) {
    setAppliedSearch(rawSearch);
    const nextDeepLink = parseDeepLink(new URLSearchParams(rawSearch));
    if (nextDeepLink) {
      if (nextDeepLink.dealTypes) setDealTypes(nextDeepLink.dealTypes);
      if (nextDeepLink.buildingTypes) setBuildingTypes(nextDeepLink.buildingTypes);
      if (nextDeepLink.keyword !== undefined) {
        setKeyword(nextDeepLink.keyword);
        setKeywordDraft(nextDeepLink.keyword);
      }
      if (nextDeepLink.sheet) setSheetState(nextDeepLink.sheet);
    }
  }

  // 지역 이동(rg)은 명령형 지도 조작이라 렌더에서 못 한다 — 쿼리가 "바뀐" 때만 panTo
  // (첫 마운트는 MapView initialCenter가 처리하므로 건너뛴다)
  const isFirstSearchRunRef = useRef(true);
  useEffect(() => {
    if (isFirstSearchRunRef.current) {
      isFirstSearchRunRef.current = false;
      return;
    }
    const regionCenter = rawSearch
      ? parseDeepLink(new URLSearchParams(rawSearch))?.regionCenter
      : undefined;
    if (regionCenter) {
      mapCommandRef.current?.panTo(regionCenter.lat, regionCenter.lng, MAP_INITIAL_ZOOM);
    }
  }, [rawSearch]);

  /* ── 선택·이동 ── */
  const markersRef = useRef(markers);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const scrollRailToCard = useCallback((propertyId: number) => {
    railRef.current
      ?.querySelector(`[data-property-id="${propertyId}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const handleMarkerClick = useCallback(
    (propertyId: number) => {
      setSelectedId(propertyId);
      markSeen(propertyId);
      // 시안 동작: 마커 탭 → 시트가 peek이면 half로 올리고 레일에서 카드 센터링
      setSheetState((current) => (current === "peek" ? "half" : current));
      window.setTimeout(() => scrollRailToCard(propertyId), 60);
      const marker = markersRef.current.find((markerDatum) => markerDatum.id === propertyId);
      // 시안: 핀이 시트에 가리지 않게 살짝 아래를 중심으로
      if (marker) mapCommandRef.current?.panTo(marker.lat - 0.0016, marker.lng);
    },
    [markSeen, scrollRailToCard],
  );

  // 카드 클릭 = 선택, 선택된 카드 재클릭 = 상세 이동
  const handleCardClick = useCallback(
    (propertyId: number) => {
      if (selectedId === propertyId) {
        router.push(`/properties/${propertyId}`);
        return;
      }
      setSelectedId(propertyId);
      markSeen(propertyId);
      const marker = markersRef.current.find((markerDatum) => markerDatum.id === propertyId);
      if (marker) mapCommandRef.current?.panTo(marker.lat, marker.lng);
    },
    [selectedId, markSeen, router],
  );
  const handleCardHover = useCallback((propertyId: number | null) => {
    setHoveredId(propertyId);
  }, []);
  const handleDongClick = useCallback((dongDatum: MapDongDatum) => {
    mapCommandRef.current?.panTo(dongDatum.lat, dongDatum.lng, 15);
  }, []);

  /* ── 지역 검색(간이) — 사전 매칭 → 지도 이동 ── */
  const handleRegionSearch = useCallback(() => {
    const query = keywordDraft.trim();
    const region = MAP_REGIONS.find((candidate) => query.includes(candidate.label));
    if (region) {
      mapCommandRef.current?.panTo(region.lat, region.lng, 15);
      setKeyword(""); // 지역 이동은 키워드 필터가 아니다
      setKeywordDraft("");
      return;
    }
    // 지역이 아니면 건물명 키워드 검색 — 서버 스키마 상한과 같은 값으로 자른다(초과 시 조용한 실패 방지)
    setKeyword(query.slice(0, MAP_KEYWORD_MAX_LENGTH));
  }, [keywordDraft]);

  /* ── 현위치 FAB ── */
  const handleLocate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) =>
        mapCommandRef.current?.panTo(position.coords.latitude, position.coords.longitude, 16),
      () => {
        /* 거부·실패 시 조용히 무시 — 지도는 그대로 쓸 수 있다 */
      },
      { timeout: 5000 },
    );
  }, []);

  /* ── 바텀시트 드래그(명율 raf 방식) ── */
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{ startY: number; startOffset: number; latestY: number } | null>(
    null,
  );
  const sheetRafRef = useRef<number | null>(null);

  const sheetOffsetFor = useCallback((state: SheetState, viewportHeight: number) => {
    if (state === "peek") return viewportHeight - SHEET_PEEK_PX;
    if (state === "half") return viewportHeight * SHEET_HALF_RATIO;
    return viewportHeight * SHEET_FULL_RATIO;
  }, []);

  const handleSheetPointerDown = useCallback(
    (event: React.PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const viewportHeight = sheet.parentElement?.clientHeight ?? window.innerHeight;
      sheetDragRef.current = {
        startY: event.clientY,
        startOffset: sheetOffsetFor(sheetState, viewportHeight),
        latestY: event.clientY,
      };
      sheet.style.transitionDuration = "0ms";
      (event.target as Element).setPointerCapture?.(event.pointerId);
    },
    [sheetState, sheetOffsetFor],
  );
  const handleSheetPointerMove = useCallback((event: React.PointerEvent) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    drag.latestY = event.clientY;
    if (sheetRafRef.current !== null) return;
    sheetRafRef.current = requestAnimationFrame(() => {
      sheetRafRef.current = null;
      const sheet = sheetRef.current;
      const currentDrag = sheetDragRef.current;
      if (!sheet || !currentDrag) return;
      const viewportHeight = sheet.parentElement?.clientHeight ?? window.innerHeight;
      const nextOffset = Math.max(
        viewportHeight * SHEET_FULL_RATIO,
        Math.min(
          viewportHeight - SHEET_PEEK_PX,
          currentDrag.startOffset + (currentDrag.latestY - currentDrag.startY),
        ),
      );
      sheet.style.transform = `translateY(${nextOffset}px)`;
    });
  }, []);
  const handleSheetPointerUp = useCallback(() => {
    const drag = sheetDragRef.current;
    const sheet = sheetRef.current;
    sheetDragRef.current = null;
    if (sheetRafRef.current !== null) {
      cancelAnimationFrame(sheetRafRef.current);
      sheetRafRef.current = null;
    }
    if (!drag || !sheet) return;
    const viewportHeight = sheet.parentElement?.clientHeight ?? window.innerHeight;
    const finalOffset = drag.startOffset + (drag.latestY - drag.startY);
    const candidates: [SheetState, number][] = (["peek", "half", "full"] as const).map((state) => [
      state,
      sheetOffsetFor(state, viewportHeight),
    ]);
    candidates.sort((a, b) => Math.abs(a[1] - finalOffset) - Math.abs(b[1] - finalOffset));
    sheet.style.transitionDuration = "";
    sheet.style.transform = "";
    setSheetState(candidates[0][0]);
  }, [sheetOffsetFor]);

  /* ── 필터 토글 ── */
  const toggleDealType = (dealType: DealType) =>
    setDealTypes((current) =>
      current.includes(dealType)
        ? current.filter((code) => code !== dealType)
        : [...current, dealType],
    );
  const toggleBuildingGroup = (types: BuildingType[]) =>
    setBuildingTypes((current) => {
      const isOn = types.every((buildingType) => current.includes(buildingType));
      if (isOn) return current.filter((buildingType) => !types.includes(buildingType));
      return [...new Set([...current, ...types])];
    });
  const hasAnyFilter = dealTypes.length > 0 || buildingTypes.length > 0 || keyword !== "";
  const clearFilters = () => {
    setDealTypes([]);
    setBuildingTypes([]);
    setKeyword("");
    setKeywordDraft("");
  };

  /* ── 공용 조각 ── */

  const chipClass = (isOn: boolean) =>
    `flex-none min-h-11 rounded-full border px-[13px] text-[13px] font-semibold shadow-float transition-colors ${
      isOn ? "border-ink bg-ink text-white" : "border-ink/10 bg-surface/95 text-ink-70"
    }`;

  const filterChips = (
    <div
      className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]"
      role="group"
      aria-label="매물 필터"
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
      <span className="mx-0.5 h-5 w-px flex-none bg-ink/10" aria-hidden="true" />
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
  );

  const emptyState = (
    <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-ink-40">
      <span>이 영역에 매물이 없습니다. 지도를 움직여 보거나 조건을 넓혀보세요.</span>
      {hasAnyFilter && (
        <button
          type="button"
          onClick={clearFilters}
          className="min-h-11 rounded-md border border-accent px-4 text-sm font-medium text-accent"
        >
          필터 초기화
        </button>
      )}
    </div>
  );

  const verticalList = (
    <div className="flex flex-col px-4 pb-24">
      {markers.map((markerDatum) => (
        <div key={markerDatum.id} data-property-id={markerDatum.id}>
          <MapCard
            property={markerDatum}
            variant="list"
            isActive={markerDatum.id === selectedId || markerDatum.id === hoveredId}
            onClickProperty={handleCardClick}
            onHoverProperty={handleCardHover}
          />
        </div>
      ))}
      {markers.length === 0 && mapSearch.data?.mode === "markers" && emptyState}
      {mapSearch.data?.mode === "dong" && (
        <p className="p-6 text-center text-sm text-ink-40">
          지도를 확대하면 개별 매물이 표시됩니다.
        </p>
      )}
    </div>
  );

  const mapCanvas = (
    <div className="relative h-full w-full">
      <MapView
        initialCenter={deepLink?.regionCenter ?? snapshot?.center ?? MAP_INITIAL_CENTER}
        initialZoom={deepLink?.regionCenter ? MAP_INITIAL_ZOOM : (snapshot?.zoom ?? MAP_INITIAL_ZOOM)}
        markers={markers}
        dongGroups={dongGroups}
        selectedPropertyId={selectedId}
        hoveredPropertyId={hoveredId}
        seenPropertyIds={seenIds}
        onViewportChange={setViewport}
        onMarkerClick={handleMarkerClick}
        onMarkerHover={handleCardHover}
        onDongClick={handleDongClick}
        commandRef={mapCommandRef}
      />
      {(mapSearch.isFetching || truncated) && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-full bg-ink/80 px-3 py-1.5 text-xs font-medium text-white shadow-float">
            {mapSearch.isFetching ? "매물 불러오는 중…" : "매물이 많아요 — 지도를 더 확대해 주세요"}
          </span>
        </div>
      )}
    </div>
  );

  const resultAnnouncement = (
    <span aria-live="polite" className="sr-only">
      {mapSearch.isFetching ? "매물을 불러오는 중" : `이 지역 매물 ${totalVisible}건`}
    </span>
  );

  /* ═════════ PC (≥900px) — [조건 패널 296px | 목록 | 지도] (확정안 PC2) ═════════ */
  if (isDesktop) {
    return (
      <div className="grid h-dvh w-full grid-cols-[296px_360px_1fr] overflow-hidden">
        {resultAnnouncement}
        {/* 좌: 조건 패널 — 검색란이 맨 위(의뢰인 지시) */}
        <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleRegionSearch();
            }}
          >
            <label className="block text-[12.5px] font-bold text-ink-70" htmlFor="map-keyword">
              매물 검색
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <input
                id="map-keyword"
                type="search"
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                maxLength={MAP_KEYWORD_MAX_LENGTH}
                placeholder="건물명 · 단지 · 지역"
                className="h-11 min-w-0 flex-1 rounded-md border border-line px-3 text-sm"
              />
              <button
                type="submit"
                className="h-11 flex-none rounded-md bg-accent px-3.5 text-[13px] font-bold text-white"
              >
                검색
              </button>
            </div>
            {keyword && (
              <p className="mt-1.5 text-xs text-ink-70">
                &ldquo;{keyword}&rdquo; 검색 중 ·{" "}
                <button type="button" className="underline" onClick={() => { setKeyword(""); setKeywordDraft(""); }}>
                  지우기
                </button>
              </p>
            )}
          </form>

          <div>
            <p className="text-[12.5px] font-bold text-ink-70">건물</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BUILDING_GROUP_CHIPS.map((group) => {
                const isOn = group.types.every((buildingType) =>
                  buildingTypes.includes(buildingType),
                );
                return (
                  <button
                    key={group.label}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleBuildingGroup(group.types)}
                    className={`min-h-11 rounded-[9px] border px-[13px] text-[13.5px] font-semibold transition-colors ${
                      isOn
                        ? "border-accent bg-accent-soft font-bold text-accent"
                        : "border-line bg-surface text-ink-70"
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[12.5px] font-bold text-ink-70">거래</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DEAL_TYPES.map((dealType) => {
                const isOn = dealTypes.includes(dealType);
                return (
                  <button
                    key={dealType}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleDealType(dealType)}
                    className={`min-h-11 rounded-[9px] border px-[13px] text-[13.5px] font-semibold transition-colors ${
                      isOn
                        ? "border-accent bg-accent-soft font-bold text-accent"
                        : "border-line bg-surface text-ink-70"
                    }`}
                  >
                    {DEAL_TYPE_LABEL[dealType]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[12.5px] font-bold text-ink-70">지역 바로가기</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MAP_REGIONS.map((region) => (
                <button
                  key={region.label}
                  type="button"
                  onClick={() => mapCommandRef.current?.panTo(region.lat, region.lng, 15)}
                  className="min-h-11 rounded-[9px] border border-line px-[13px] text-[13.5px] text-ink-70 hover:bg-surface-alt"
                >
                  {region.label}
                </button>
              ))}
            </div>
          </div>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-md border border-line text-sm text-ink-70 hover:bg-surface-alt"
            >
              조건 초기화
            </button>
          )}
          <div className="mt-auto" />
        </aside>

        {/* 중: 목록 */}
        <section className="flex h-full min-h-0 flex-col border-r border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[14.5px] font-bold">
              이 지역 매물 <b className="num text-accent">{totalVisible}</b>건
            </p>
            <span className="text-[12.5px] font-semibold text-ink-70">최신순</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{verticalList}</div>
          <OfficeLegalLine officeInfo={officeInfo.data} />
        </section>

        {/* 우: 지도 */}
        <section className="relative h-full">{mapCanvas}</section>
      </div>
    );
  }

  /* ═════════ 모바일 (<900px) — M3 확정 구조 ═════════ */
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {resultAnnouncement}
      {mapCanvas}

      {/* 상단 오버레이: 검색바 + [목록] 토글 + 필터 칩 */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex gap-2">
          <form
            className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-surface px-3 shadow-float focus-within:ring-2 focus-within:ring-accent"
            onSubmit={(event) => {
              event.preventDefault();
              handleRegionSearch();
            }}
          >
            <span aria-hidden="true" className="text-ink-40">
              🔍
            </span>
            <input
              type="search"
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              maxLength={MAP_KEYWORD_MAX_LENGTH}
              placeholder="지역 · 건물명 검색"
              aria-label="지역·건물명 검색"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-ink-40"
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
          <button
            type="button"
            onClick={() => setSheetState("full")}
            className="flex h-11 flex-none items-center gap-1.5 rounded-xl bg-ink px-[13px] text-[13.5px] font-bold text-white shadow-float"
          >
            ☰ 목록
          </button>
        </div>
        <div className="pointer-events-auto">{filterChips}</div>
      </div>

      {/* 현위치 FAB — 시트 peek 위 */}
      <button
        type="button"
        aria-label="현재 위치로 이동"
        onClick={handleLocate}
        className="absolute right-3.5 z-10 flex size-11 items-center justify-center rounded-full bg-surface text-accent shadow-float"
        style={{ bottom: SHEET_PEEK_PX + 14 }}
      >
        ◎
      </button>

      {/* 바텀시트 — half=가로 카드 레일 / full=세로 리스트 (확정 시안) */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 top-0 z-20 h-full will-change-transform rounded-t-[18px] bg-surface shadow-sheet transition-transform"
        style={{
          transform:
            sheetState === "peek"
              ? `translateY(calc(100% - ${SHEET_PEEK_PX}px))`
              : sheetState === "half"
                ? `translateY(${SHEET_HALF_RATIO * 100}%)`
                : `translateY(${SHEET_FULL_RATIO * 100}%)`,
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          transitionDuration: "280ms",
        }}
      >
        <button
          type="button"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
          aria-label={
            sheetState === "peek"
              ? "매물 목록 열기"
              : sheetState === "half"
                ? "매물 목록 전체 화면으로 넓히기"
                : "매물 목록 접기"
          }
          onClick={() =>
            setSheetState((current) =>
              current === "peek" ? "half" : current === "half" ? "full" : "peek",
            )
          }
          className="flex w-full touch-none flex-col items-center pt-2"
        >
          <span className="h-1 w-9 rounded-[2px] bg-[#D4CFC6]" aria-hidden="true" />
          <span className="flex w-full items-center justify-between px-4 pt-2 pb-2.5">
            <span className="text-[14.5px] font-bold">
              이 지역 매물 <b className="num text-accent">{totalVisible}</b>건
            </span>
            <span className="text-[12.5px] font-semibold text-ink-70">최신순 ▾</span>
          </span>
        </button>

        <div
          className="flex h-[calc(100%-64px)] flex-col"
          inert={sheetState === "peek" ? true : undefined}
        >
          {/* half: 가로 카드 레일 + 법정 표기 — 표기는 half에서도 화면에 있어야 한다(§18의2) */}
          {sheetState !== "full" && (
            <>
              <div
                ref={railRef}
                className="flex gap-2.5 overflow-x-auto px-4 pt-0.5 pb-4 [scrollbar-width:none]"
              >
                {markers.map((markerDatum) => (
                  <div key={markerDatum.id} data-property-id={markerDatum.id} className="flex-none">
                    <MapCard
                      property={markerDatum}
                      variant="rail"
                      isActive={markerDatum.id === selectedId}
                      onClickProperty={handleCardClick}
                    />
                  </div>
                ))}
                {markers.length === 0 && mapSearch.data?.mode === "markers" && (
                  <div className="w-full">{emptyState}</div>
                )}
                {mapSearch.data?.mode === "dong" && (
                  <p className="w-full p-6 text-center text-sm text-ink-40">
                    지도를 확대하면 개별 매물이 표시됩니다.
                  </p>
                )}
              </div>
              <OfficeLegalLine officeInfo={officeInfo.data} />
            </>
          )}
          {/* full: 세로 리스트 */}
          {sheetState === "full" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {verticalList}
              <OfficeLegalLine officeInfo={officeInfo.data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
