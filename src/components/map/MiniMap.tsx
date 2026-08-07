"use client";

import { useEffect, useRef, useState } from "react";

import type { DealType } from "@/lib/codes";

import { loadNaverMaps } from "./naver-loader";
import { priceTagMarkerHtml } from "./price-tag-marker";

/**
 * 상세 화면 지도 미니뷰 — 확정안 baegot-map-mini(검색·필터·시트 없이 지도만).
 * 가격 핀 1개 고정. 페이지 스크롤을 방해하지 않게 휠 줌은 끈다(드래그·핀치만).
 */
export type MiniMapProps = {
  lat: number;
  lng: number;
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
};

export default function MiniMap({
  lat,
  lng,
  dealType,
  salePrice,
  deposit,
  monthlyRent,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 실패는 "이번 시도 키"로 기록 — props가 바뀌면 파생값이 자동 리셋되어 재시도가 산다
  const attemptKey = `${lat},${lng},${dealType},${salePrice},${deposit},${monthlyRent}`;
  const [failedAttemptKey, setFailedAttemptKey] = useState<string | null>(null);
  const loadFailed = failedAttemptKey === attemptKey;

  useEffect(() => {
    let disposed = false;
    let map: naver.maps.Map | null = null;

    const initMap = () => {
      const container = containerRef.current;
      if (disposed || !container || map) return;
      loadNaverMaps()
        .then((maps) => {
          if (disposed || map) return;
          const center = new maps.LatLng(lat, lng);
          // 줌 컨트롤 없음 — role="img" 컨테이너 안의 인터랙티브 자식은 이름·역할이 지워진다
          // (핀치·드래그·더블탭 줌은 유지되므로 기능 손실 없음)
          map = new maps.Map(container, {
            center,
            zoom: 16,
            scrollWheel: false,
            zoomControl: false,
          });
          new maps.Marker({
            map,
            position: center,
            icon: {
              // 말풍선 폭이 가변이라 픽셀 anchor 대신 CSS로 하단 중앙 정렬(지도 화면과 동일)
              content: `<div style="transform:translate(-50%,-100%)">${priceTagMarkerHtml({
                dealType,
                salePrice,
                deposit,
                monthlyRent,
                isSeen: false,
                isSelected: true,
                hasVideo: false,
              })}</div>`,
              anchor: new maps.Point(0, 0),
            },
          });
        })
        .catch(() => {
          if (!disposed) setFailedAttemptKey(attemptKey);
        });
    };

    // M4/PC3 이중 레이아웃에서 숨겨진 쪽(display:none, 0-크기)은 초기화하지 않는다.
    // ① 지금 크기가 있으면 동기 초기화(옵저버 콜백은 렌더 파이프라인 의존이라 기다리지 않는다)
    // ② 숨김→표시 전환(뷰포트 리사이즈·회전)은 IntersectionObserver가 잡는다.
    const container = containerRef.current;
    if (!container) return;
    if (container.clientWidth > 0 && container.clientHeight > 0) initMap();
    const intersectionObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) initMap();
    });
    intersectionObserver.observe(container);

    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      map?.destroy();
      map = null;
    };
  }, [lat, lng, dealType, salePrice, deposit, monthlyRent, attemptKey]);

  // 컨테이너는 항상 렌더 — 실패 문구를 컨테이너로 "대체"하면 ref가 사라져 재시도 경로가 죽는다
  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" role="img" aria-label="매물 위치 지도" />
      {loadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-alt text-sm text-ink-70">
          지도를 불러오지 못했습니다
        </div>
      )}
    </div>
  );
}
