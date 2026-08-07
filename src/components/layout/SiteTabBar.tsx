"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Home, List, Map as MapIcon, MessageSquareText, type LucideIcon } from "lucide-react";

/**
 * 모바일 하단 탭바 — 확정안 M1 §7. 홈 / 매물 / 지도 / 문의.
 * ('이야기' 탭은 확정안에서 2차로 제외된 화면이라 두지 않는다.)
 * '매물' 활성은 목록(/properties)만 — 상세는 목록·지도 어느 쪽에서도 들어온다.
 */
const TAB_ITEMS: {
  tabLabel: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}[] = [
  { tabLabel: "홈", href: "/", icon: Home, isActive: (pathname) => pathname === "/" },
  {
    tabLabel: "매물",
    href: "/properties",
    icon: List,
    isActive: (pathname) => pathname === "/properties",
  },
  { tabLabel: "지도", href: "/map", icon: MapIcon, isActive: (pathname) => pathname.startsWith("/map") },
  {
    tabLabel: "문의",
    href: "/inquiry",
    icon: MessageSquareText,
    isActive: (pathname) => pathname.startsWith("/inquiry"),
  },
];

export function SiteTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EFEAE0] bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex h-16 items-stretch">
        {TAB_ITEMS.map((tab) => {
          const active = tab.isActive(pathname);
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.tabLabel}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] ${
                active ? "text-ink" : "text-[#96A1A7]"
              }`}
            >
              <TabIcon size={19} strokeWidth={active ? 2.4 : 2} aria-hidden />
              <span className="text-[10px] leading-none font-bold">{tab.tabLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
