import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

/**
 * 관리자 메뉴 단일 출처 — 사이드바(PC)와 드로어(모바일)가 같은 목록을 그린다.
 * 순서·스타일은 확정 기획 A0(사이드바 208px #0B2430). 기획의 6항목 중
 * 영상·콘텐츠/통계/설정은 2·3단계 화면이라 라우트가 생길 때 추가한다(죽은 링크 금지).
 * '등록 의뢰'는 기획 메뉴엔 없지만 이미 있는 기능이라 유지한다.
 */

export type AdminNavItem = {
  itemId: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** 하위 경로도 활성으로 볼지 (목록 ↔ 수정 화면) */
  matchPrefix?: boolean;
  /** 미처리 문의 건수 배지(골드 pill)를 붙일 항목 */
  showInquiryBadge?: boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { itemId: "dashboard", label: "대시보드", href: "/admin", icon: LayoutDashboard },
  {
    itemId: "properties",
    label: "매물 관리",
    href: "/admin/properties",
    icon: Building2,
    matchPrefix: true,
  },
  {
    itemId: "inquiries",
    label: "상담 문의",
    href: "/admin/inquiries",
    icon: MessageSquare,
    showInquiryBadge: true,
  },
  { itemId: "requests", label: "등록 의뢰", href: "/admin/requests", icon: ClipboardList },
];

/** 현재 경로에 해당하는 메뉴 href — 가장 구체적인(긴) 매치 우선 */
export function matchAdminNavHref(pathname: string): string | null {
  let matched: AdminNavItem | null = null;
  for (const item of ADMIN_NAV_ITEMS) {
    const hit =
      pathname === item.href || (item.matchPrefix && pathname.startsWith(item.href + "/"));
    if (hit && (!matched || item.href.length > matched.href.length)) matched = item;
  }
  return matched?.href ?? null;
}

/** 상단바 페이지 타이틀 — 경로 기반. 매핑에 없으면 "관리자" */
export function adminPageTitle(pathname: string): string {
  if (pathname === "/admin") return "대시보드";
  if (pathname === "/admin/properties") return "매물 관리";
  if (pathname === "/admin/properties/new") return "매물 등록";
  if (/^\/admin\/properties\/\d+\/edit$/.test(pathname)) return "매물 수정";
  if (pathname === "/admin/inquiries") return "상담 문의";
  if (pathname === "/admin/requests") return "등록 의뢰";
  return "관리자";
}
