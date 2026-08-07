import { formatManwon, type PropertyPriceInput } from "@/domain/price";
import type { DealType } from "@/lib/codes";

/**
 * 가격 라벨 핀 HTML — 확정 시안(baegot-map.html) 그대로:
 * 흰 말풍선 + 거래유형 색 점 + 압축 가격 + 흰 꼬리.
 * 상태: 기본 / seen(방문 — 회색) / on(선택 — 딥네이비 반전).
 * 색 점의 의미는 시트 카드의 텍스트 배지(매매/전세/월세)가 병행 전달한다.
 *
 * naver.maps.Marker icon.content로 들어가는 원시 HTML. 들어오는 값은 전부
 * 서버 코드값·숫자라(자유 텍스트 없음) 이스케이프 이슈가 없다.
 */

/** 거래유형 점·배지 색 (확정 시안 C 맵). 단기임대는 월세 계열 */
export const DEAL_COLOR: Record<DealType, { fg: string; bg: string }> = {
  SALE: { fg: "#1F5F7D", bg: "#E3EDF3" },
  JEONSE: { fg: "#16766A", bg: "#DDEFEB" },
  MONTHLY: { fg: "#9A6A1F", bg: "#F6EBD8" },
  SHORT: { fg: "#9A6A1F", bg: "#F6EBD8" },
};

/**
 * 핀 압축 가격 (시안 short 포맷) — 월세 "5000/320"(보증금 콤마 제거),
 * 매매·전세 "4억8,000"(억 뒤 공백 제거). 지도의 좁은 말풍선에 맞춘 표기다.
 */
export function markerShortPrice(price: PropertyPriceInput): string {
  if (price.dealType === "MONTHLY" || price.dealType === "SHORT") {
    if (price.deposit === null || price.monthlyRent === null) return "협의";
    return `${String(price.deposit)}/${String(price.monthlyRent)}`;
  }
  const amount = price.dealType === "SALE" ? price.salePrice : price.deposit;
  return amount === null ? "협의" : formatManwon(amount).replace("억 ", "억");
}

export type PriceTagMarkerInput = PropertyPriceInput & {
  hasVideo: boolean;
  isSelected: boolean;
  /** 방문(본 매물) — 상세를 다녀온 매물은 톤 다운(시안 seen) */
  isSeen: boolean;
};

export function priceTagMarkerHtml(input: PriceTagMarkerInput): string {
  const stateClass = `${input.isSeen ? " map-pin--seen" : ""}${input.isSelected ? " map-pin--on" : ""}`;
  const videoDot = input.hasVideo ? '<i class="map-pin-video" aria-hidden="true">▶</i>' : "";
  return `<div class="map-pin${stateClass}">
  <span class="map-pin-bub"><i class="map-pin-dot" style="background:${DEAL_COLOR[input.dealType].fg}"></i>${videoDot}<span class="map-pin-pr">${markerShortPrice(input)}</span></span>
  <span class="map-pin-tail"></span>
</div>`;
}

/** icon.content는 원시 HTML — 관리자 입력이라도 저장형 XSS 싱크가 되지 않게 이스케이프 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 동 집계 클러스터 — 틸 원 + "N 매물" (확정 시안). 크기는 건수 비례 40~58px */
export function dongClusterHtml(dong: string, propertyCount: number): string {
  const size = 40 + Math.min(18, propertyCount);
  return `<div class="map-cluster" style="width:${size}px;height:${size}px" title="${escapeHtml(dong)}"><b>${propertyCount}</b><i>매물</i></div>`;
}
