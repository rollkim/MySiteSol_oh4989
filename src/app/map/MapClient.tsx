"use client";

import dynamic from "next/dynamic";

/**
 * 지도 화면의 클라이언트 경계 — 네이버 SDK는 서버 렌더가 불가능하므로
 * ssr:false dynamic은 여기(클라이언트 컴포넌트) 안에서만 선언한다(AGENTS.md 고정 원칙).
 */
const MapScreen = dynamic(() => import("./MapScreen").then((m) => m.MapScreen), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-surface-alt text-sm text-ink-40">
      지도를 준비하는 중…
    </div>
  ),
});

export function MapClient() {
  return <MapScreen />;
}
