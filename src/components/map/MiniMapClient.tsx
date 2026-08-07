"use client";

import dynamic from "next/dynamic";

/** 지도는 절대 서버 렌더하지 않는다(AGENTS.md) — 상세 미니뷰도 동일 */
export const MiniMapClient = dynamic(() => import("./MiniMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-alt" aria-hidden />,
});
