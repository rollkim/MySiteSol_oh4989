import type { Metadata } from "next";

import { MapClient } from "./MapClient";

export const metadata: Metadata = {
  title: "지도로 매물 찾기",
  description: "배곧 매물을 지도에서 바로 찾아보세요 — 상가·오피스텔·아파트 실매물.",
};

/** 지도 검색 (SPEC §2 /map) — 본체는 전부 클라이언트(지도 SSR 금지) */
export default function MapPage() {
  return <MapClient />;
}
