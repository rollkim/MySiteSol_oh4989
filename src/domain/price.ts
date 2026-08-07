import type { DealType } from "@/lib/codes";

/**
 * 가격 표기 — 만원 단위 정수(RULE-11)를 한국식 문자열로. 통화기호를 쓰지 않는다.
 * 지도 마커·목록 카드·상세가 전부 이 함수를 쓴다 — 표기가 갈리면 같은 매물이
 * 화면마다 다른 가격으로 보인다.
 */

/** 만원 정수 → "4억 3,000" · "15억" · "3,100" */
export function formatManwon(manwon: number): string {
  if (!Number.isInteger(manwon) || manwon < 0) {
    throw new Error(`만원 단위 정수가 아닙니다: ${manwon}`);
  }
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok === 0) return rest.toLocaleString("ko-KR");
  if (rest === 0) return `${eok.toLocaleString("ko-KR")}억`;
  return `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}`;
}

export type PropertyPriceInput = {
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
};

/**
 * 거래유형별 대표 가격 문자열. 유형 라벨(배지)은 따로 붙는다.
 * 값이 비어 있으면 "가격 협의" — ACTIVE는 스키마 검증이 가격을 강제하므로
 * 실제로는 작성 중(HIDDEN) 미리보기에서만 나온다.
 */
export function formatPropertyPrice(price: PropertyPriceInput): string {
  switch (price.dealType) {
    case "SALE":
      return price.salePrice === null ? "가격 협의" : formatManwon(price.salePrice);
    case "JEONSE":
      return price.deposit === null ? "가격 협의" : formatManwon(price.deposit);
    case "MONTHLY":
    case "SHORT": {
      if (price.deposit === null || price.monthlyRent === null) return "가격 협의";
      return `${formatManwon(price.deposit)}/${price.monthlyRent.toLocaleString("ko-KR")}`;
    }
  }
}

/** 관리비 총액 표기. 0·null은 "없음" — 관리비 없는 매물의 법정 표기다 */
export function formatMaintenanceFee(manwon: number | null): string {
  if (manwon === null || manwon === 0) return "없음";
  return `월 ${formatManwon(manwon)}만원`;
}

/**
 * 권리금 표기 (상가·사무실). 0은 "없음"(그 자체가 정보 — 네이버부동산 관례),
 * null은 미기재라 호출측이 행 자체를 생략한다.
 */
export function formatPremiumFee(manwon: number | null): string {
  if (manwon === null) return "";
  if (manwon === 0) return "없음";
  return `${formatManwon(manwon)}만원`;
}
