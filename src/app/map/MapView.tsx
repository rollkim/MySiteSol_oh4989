"use client";

import { useEffect, useRef, useState } from "react";

import { loadNaverMaps } from "@/components/map/naver-loader";
import { dongClusterHtml, priceTagMarkerHtml } from "@/components/map/price-tag-marker";
import type { BuildingType, DealType } from "@/lib/codes";

/**
 * 순수 지도 뷰 — SDK 로드·마커 diff·이벤트 중계만 한다. 데이터는 부모(MapScreen) 소유.
 * 서버 렌더 금지(AGENTS.md) — 부모가 dynamic({ ssr: false })로만 불러온다.
 *
 * 성능 방식은 명율 Properties.tsx의 실전 패턴을 계승:
 *  - 마커는 id 기준 Map으로 diff — idle마다 200개를 전량 재생성하지 않는다
 *  - 아이콘 재생성은 "선택 상태가 바뀐 마커"만
 *  - idle 디바운스(400ms)로 마지막 위치 한 번만 부모에 알린다(자동 재검색용)
 */

export type MapMarkerDatum = {
  id: number;
  dealType: DealType;
  buildingType: BuildingType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: string;
  hasVideo: boolean;
  lat: number;
  lng: number;
};

export type MapDongDatum = { dong: string; propertyCount: number; lat: number; lng: number };

export type MapViewport = {
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  /** 상세 다녀온 뒤 지도 상태 복원(스냅샷 저장)에 쓴다 */
  center: { lat: number; lng: number };
  zoom: number;
};

/** 부모가 지도를 움직일 때 쓰는 명령 핸들 (동 클러스터 줌인·카드 클릭 센터 이동) */
export type MapCommand = {
  panTo: (lat: number, lng: number, zoom?: number) => void;
};

const IDLE_DEBOUNCE_MS = 400;

export function MapView({
  initialCenter,
  initialZoom,
  markers,
  dongGroups,
  selectedPropertyId,
  hoveredPropertyId,
  seenPropertyIds,
  onViewportChange,
  onMarkerClick,
  onMarkerHover,
  onDongClick,
  commandRef,
}: {
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  markers: MapMarkerDatum[];
  dongGroups: MapDongDatum[];
  selectedPropertyId: number | null;
  /** PC 리스트 hover ↔ 마커 강조 연동(§4-P1 필수 인터랙션) */
  hoveredPropertyId: number | null;
  /** 방문(본 매물) — 핀을 회색 톤으로(시안 seen) */
  seenPropertyIds: ReadonlySet<number>;
  /** idle(이동·줌 종료) 디바운스 후 호출 — 부모가 이 값으로 mapSearch를 다시 돈다 */
  onViewportChange: (viewport: MapViewport) => void;
  onMarkerClick: (propertyId: number) => void;
  /** 마커 hover → 리스트 카드 강조 (§4-P1 "양방향" 연동의 지도→리스트 방향) */
  onMarkerHover: (propertyId: number | null) => void;
  onDongClick: (dong: MapDongDatum) => void;
  commandRef: React.MutableRefObject<MapCommand | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markerEntriesRef = useRef<
    Map<number, { marker: naver.maps.Marker; datum: MapMarkerDatum; iconKey: string }>
  >(new Map());
  const dongEntriesRef = useRef<Map<string, { marker: naver.maps.Marker; count: number }>>(
    new Map(),
  );
  const idleTimerRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 이벤트 리스너는 1회만 걸고, 콜백은 ref로 항상 최신을 부른다(렌더 밖 이펙트에서 동기화)
  const callbacksRef = useRef({ onViewportChange, onMarkerClick, onMarkerHover, onDongClick });
  useEffect(() => {
    callbacksRef.current = { onViewportChange, onMarkerClick, onMarkerHover, onDongClick };
  }, [onViewportChange, onMarkerClick, onMarkerHover, onDongClick]);

  /* ── 지도 인스턴스 (1회) ── */
  useEffect(() => {
    let disposed = false;
    loadNaverMaps()
      .then((maps) => {
        if (disposed || !containerRef.current || mapRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(initialCenter.lat, initialCenter.lng),
          zoom: initialZoom,
          minZoom: 7,
          scaleControl: false,
          mapDataControl: false,
          logoControlOptions: { position: maps.Position.BOTTOM_LEFT },
          // §4-P1 우하단 [+][−] — 40~60대 사용자는 휠·핀치보다 버튼 줌이 익숙하다
          zoomControl: true,
          zoomControlOptions: { position: maps.Position.RIGHT_BOTTOM, style: maps.ZoomControlStyle.SMALL },
        });
        mapRef.current = map;
        commandRef.current = {
          panTo: (lat, lng, zoom) => {
            if (zoom !== undefined && zoom !== map.getZoom()) map.setZoom(zoom, true);
            map.panTo(new maps.LatLng(lat, lng));
          },
        };

        const emitViewport = () => {
          const bounds = map.getBounds() as naver.maps.LatLngBounds;
          const sw = bounds.getSW();
          const ne = bounds.getNE();
          // 컨테이너 크기가 0이면(레이아웃 전·백그라운드 탭) bounds가 한 점으로 붕괴해
          // 서버 검증(sw<ne)에 400으로 거부된다 — 실측으로 잡은 버그. 무시하고
          // ResizeObserver가 크기를 얻은 뒤 다시 방출한다.
          if (sw.lat() >= ne.lat() || sw.lng() >= ne.lng()) return;
          const center = map.getCenter() as naver.maps.LatLng;
          callbacksRef.current.onViewportChange({
            bounds: { sw: { lat: sw.lat(), lng: sw.lng() }, ne: { lat: ne.lat(), lng: ne.lng() } },
            center: { lat: center.lat(), lng: center.lng() },
            zoom: map.getZoom(),
          });
        };
        // 연속 이동 중 idle이 여러 번 떠도 마지막 한 번으로 모은다(명율 방식) — 자동 재검색의 비용 제어
        maps.Event.addListener(map, "idle", () => {
          if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = window.setTimeout(emitViewport, IDLE_DEBOUNCE_MS);
        });
        // 컨테이너 크기 변화(레이아웃 전환·패널 접힘·회전) 시 지도에 알리고 뷰포트 재방출 —
        // 네이버 SDK는 크기 변화를 스스로 감지하지 않는다
        const resizeObserver = new ResizeObserver(() => {
          const container = containerRef.current;
          if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
          maps.Event.trigger(map, "resize");
          emitViewport();
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        resizeObserverRef.current = resizeObserver;
        setIsReady(true);
        emitViewport(); // 첫 검색 트리거(크기 0이면 위 가드가 거르고 옵저버가 이어받는다)
      })
      .catch((error: Error) => {
        if (!disposed) setLoadError(error.message);
      });
    // 클린업에서 쓸 ref들을 이펙트 시점 값으로 고정한다(react-hooks/exhaustive-deps 경고 대응)
    const markerEntries = markerEntriesRef.current;
    const dongEntries = dongEntriesRef.current;
    return () => {
      disposed = true;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      commandRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
      markerEntries.clear();
      dongEntries.clear();
    };
    // 초기 중심·줌은 마운트 시 1회만 쓴다 — 이후엔 사용자 조작이 진실
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 마커 diff (명율 방식 — 바뀐 것만 만지기) ── */
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.naver?.maps;
    if (!map || !maps || !isReady) return;

    const highlightedId = hoveredPropertyId ?? selectedPropertyId;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextIds = new Set(markers.map((markerDatum) => markerDatum.id));

    // 사라진 마커 제거
    for (const [id, entry] of markerEntriesRef.current) {
      if (!nextIds.has(id)) {
        entry.marker.setMap(null);
        markerEntriesRef.current.delete(id);
      }
    }

    // 말풍선 폭이 가변이라 픽셀 anchor 대신 CSS로 하단 중앙 정렬(시안 방식)
    const pinContent = (markerDatum: MapMarkerDatum, isHighlighted: boolean, extra = "") => ({
      content: `<div style="transform:translate(-50%,-100%)"${extra}>${priceTagMarkerHtml({
        ...markerDatum,
        isSelected: isHighlighted,
        isSeen: seenPropertyIds.has(markerDatum.id),
      })}</div>`,
      anchor: new maps.Point(0, 0),
    });
    const iconKeyFor = (markerDatum: MapMarkerDatum, isHighlighted: boolean) =>
      `${isHighlighted ? "on" : "off"}:${seenPropertyIds.has(markerDatum.id) ? "seen" : "new"}`;

    // 신규 추가 + 상태(선택·방문) 변화만 아이콘 갱신
    let enterIndex = 0;
    for (const markerDatum of markers) {
      const isHighlighted = markerDatum.id === highlightedId;
      const iconKey = iconKeyFor(markerDatum, isHighlighted);
      const existing = markerEntriesRef.current.get(markerDatum.id);
      if (!existing) {
        // stagger 등장은 신규 20개까지만(§5-6) — reduced-motion이면 생략
        const enter =
          !reducedMotion && enterIndex < 20
            ? ` class="map-pin-enter" style="animation-delay:${enterIndex * 40}ms;transform:translate(-50%,-100%)"`
            : "";
        enterIndex += 1;
        const icon = enter
          ? {
              content: `<div${enter}>${priceTagMarkerHtml({
                ...markerDatum,
                isSelected: isHighlighted,
                isSeen: seenPropertyIds.has(markerDatum.id),
              })}</div>`,
              anchor: new maps.Point(0, 0),
            }
          : pinContent(markerDatum, isHighlighted);
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(markerDatum.lat, markerDatum.lng),
          icon,
          zIndex: isHighlighted ? 100 : 1,
        });
        maps.Event.addListener(marker, "click", () =>
          callbacksRef.current.onMarkerClick(markerDatum.id),
        );
        // 지도→리스트 방향 강조 (양방향 연동, SPEC §5)
        maps.Event.addListener(marker, "mouseover", () =>
          callbacksRef.current.onMarkerHover(markerDatum.id),
        );
        maps.Event.addListener(marker, "mouseout", () =>
          callbacksRef.current.onMarkerHover(null),
        );
        markerEntriesRef.current.set(markerDatum.id, { marker, datum: markerDatum, iconKey });
      } else if (existing.iconKey !== iconKey) {
        existing.marker.setIcon(pinContent(markerDatum, isHighlighted));
        existing.marker.setZIndex(isHighlighted ? 100 : 1);
        existing.iconKey = iconKey;
      }
    }

    // 동 클러스터 diff (키 = 동 이름)
    const nextDongs = new Set(dongGroups.map((dongDatum) => dongDatum.dong));
    for (const [dong, entry] of dongEntriesRef.current) {
      if (!nextDongs.has(dong)) {
        entry.marker.setMap(null);
        dongEntriesRef.current.delete(dong);
      }
    }
    const clusterIcon = (dongDatum: MapDongDatum) => ({
      content: `<div style="transform:translate(-50%,-50%)">${dongClusterHtml(dongDatum.dong, dongDatum.propertyCount)}</div>`,
      anchor: new maps.Point(0, 0),
    });
    for (const dongDatum of dongGroups) {
      const existing = dongEntriesRef.current.get(dongDatum.dong);
      if (!existing) {
        const marker = new maps.Marker({
          map,
          position: new maps.LatLng(dongDatum.lat, dongDatum.lng),
          icon: clusterIcon(dongDatum),
        });
        maps.Event.addListener(marker, "click", () => callbacksRef.current.onDongClick(dongDatum));
        dongEntriesRef.current.set(dongDatum.dong, { marker, count: dongDatum.propertyCount });
      } else if (existing.count !== dongDatum.propertyCount) {
        existing.marker.setIcon(clusterIcon(dongDatum));
        existing.count = dongDatum.propertyCount;
      }
    }
  }, [markers, dongGroups, selectedPropertyId, hoveredPropertyId, seenPropertyIds, isReady]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-alt p-6 text-center text-sm text-ink-70">
        {loadError}
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full" aria-label="매물 지도" />;
}
