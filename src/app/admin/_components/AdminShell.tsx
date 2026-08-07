"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Home, Menu, Plus, X } from "lucide-react";

import { WORDMARK_ALT } from "@/lib/brand";
import type { OfficeInfo } from "@/server/services/site-settings.service";
import { useTRPC } from "@/trpc/client";

import { ADMIN_NAV_ITEMS, adminPageTitle, matchAdminNavHref } from "./AdminNav";
import { LogoutButton } from "./LogoutButton";

/**
 * 관리자 공통 셸 — 확정 기획 A0: 사이드바 208px #0B2430(워드마크+ADMIN 배지·항목 h38·
 * 활성 rgba(255,255,255,.12)·문의 건수 골드 pill·하단 프로필) + 상단바 h56 흰 배경 +
 * 본문 #F1EEE8. 모바일 드로어는 기획 밖(PC 목업뿐)이지만 현장 사용(A6 예정)을 위해 유지.
 * /admin은 리스킨 대상이 아니라 기획 확정색 하드코딩이 의도다.
 */

function InquiryBadge() {
  const trpc = useTRPC();
  const newCount = useQuery(trpc.admin.inquiry.newCount.queryOptions());
  if (!newCount.data) return null;
  return (
    <span className="num ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-[#E8C87A] px-[5px] text-[10.5px] font-extrabold text-[#0B2430]">
      {newCount.data}
    </span>
  );
}

function ShellNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = matchAdminNavHref(pathname);

  return (
    <nav aria-label="관리자 메뉴" className="flex flex-1 flex-col gap-0.5 px-3 pt-3.5 pb-5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = item.href === activeHref;
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.itemId}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={`flex h-[38px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-bold no-underline transition-colors ${
              isActive ? "bg-white/12 text-white" : "text-[#9FB3BC] hover:bg-white/8 hover:text-white"
            }`}
          >
            <ItemIcon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {item.label}
            {item.showInquiryBadge && <InquiryBadge />}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="flex flex-col gap-2.5 border-b border-white/10 px-[18px] pb-[18px]">
      <div className="flex items-center gap-[9px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
        <img
          src="/brand/ohc-wordmark-white.png"
          alt={WORDMARK_ALT}
          width={311}
          height={51}
          className="h-[19px] w-auto"
        />
        <span className="rounded-[3px] bg-[#E8C87A] px-[5px] py-0.5 text-[10px] font-extrabold text-[#0B2430]">
          ADMIN
        </span>
      </div>
      {/* 홈페이지 바로가기 — 새 창(관리 작업 중이던 화면을 잃지 않게) */}
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-white/20 px-2.5 text-[12px] font-bold text-[#CFE0E6] transition-colors hover:bg-white/10 hover:text-white"
      >
        <Home className="size-3.5 flex-none" strokeWidth={2} aria-hidden="true" />
        홈페이지 보기
        <ExternalLink className="ml-auto size-3 flex-none opacity-70" aria-hidden="true" />
      </a>
    </div>
  );
}

/** 사이드바 하단 프로필 — displayName(admin_users)이 없으면 loginId */
function ProfileRow() {
  const trpc = useTRPC();
  const me = useQuery(trpc.admin.auth.me.queryOptions());
  return (
    <>
      {/* 하단 홈페이지 바로가기 — 메뉴를 다 내려온 자리에서도 손이 닿게 */}
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="mt-auto flex min-h-11 items-center gap-2 px-[18px] text-[12px] font-bold text-[#9FB3BC] transition-colors hover:text-white"
      >
        <Home className="size-3.5 flex-none" strokeWidth={2} aria-hidden="true" />
        홈페이지로 이동
        <ExternalLink className="size-3 flex-none opacity-70" aria-hidden="true" />
      </a>
      <div className="flex items-center gap-[9px] border-t border-white/10 px-[18px] pt-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
        <img
          src="/brand/ohc-profile.jpg"
          alt=""
          className="h-[30px] w-[30px] flex-none rounded-full object-cover [object-position:50%_22%]"
        />
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-xs font-bold text-white">
            {me.data?.displayName ?? me.data?.loginId ?? "…"}
          </span>
          <LogoutButton variant="sidebar" />
        </div>
      </div>
    </>
  );
}

export function AdminShell({
  officeInfo,
  children,
}: {
  officeInfo: OfficeInfo | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const closeDrawer = () => setIsDrawerOpen(false);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  /* 드로어는 모달이다 — 열리면 닫기 버튼으로 포커스를 옮기고 ESC로 닫는다 */
  useEffect(() => {
    if (!isDrawerOpen) return;
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  /* 등록·수정 화면에서는 상단 '매물 등록' CTA를 감춘다 — 작성 중 이탈 유도 방지 */
  const isPropertyForm =
    pathname === "/admin/properties/new" || /^\/admin\/properties\/\d+\/edit$/.test(pathname);

  const sidebarBody = (
    <>
      <BrandMark />
      <ShellNav onNavigate={closeDrawer} />
      <ProfileRow />
    </>
  );

  return (
    <div className="relative min-h-dvh bg-[#F1EEE8] text-[#0B2430]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-[300] focus:rounded-md focus:border focus:border-[#E5DFD4] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        본문 바로가기
      </a>

      <div className="grid min-h-dvh grid-cols-1 min-[900px]:grid-cols-[208px_1fr]">
        {/* ── 좌측 네이비 사이드바 (≥900px) — 확정 208px #0B2430 ── */}
        <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#0B2430] pt-5 pb-4 min-[900px]:flex">
          {sidebarBody}
        </aside>

        {/* ── 모바일 드로어 ── */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-[200] min-[900px]:hidden">
            {/* 배경은 장식 — 닫기 버튼은 아래 X 하나만 두어 같은 라벨이 중복되지 않게 한다 */}
            <div aria-hidden="true" onClick={closeDrawer} className="absolute inset-0 bg-[#0B2430]/50" />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="관리자 메뉴"
              className="absolute inset-y-0 left-0 flex w-[min(260px,82vw)] flex-col overflow-y-auto bg-[#0B2430] pt-5 pb-4"
            >
              <div className="flex items-start justify-between pr-2">
                <div className="flex-1">
                  <BrandMark />
                </div>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  aria-label="메뉴 닫기"
                  onClick={closeDrawer}
                  className="flex size-11 items-center justify-center rounded-md text-[#9FB3BC] hover:text-white"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {/* 드로어에도 같은 메뉴·프로필 */}
              <ShellNav onNavigate={closeDrawer} />
              <ProfileRow />
            </div>
          </div>
        )}

        {/* ── 콘텐츠 컬럼 ── */}
        <div className="flex min-w-0 flex-col">
          {/* 상단바 — 확정 h56 · 흰 배경 · border-bottom #E5DFD4 */}
          <header className="sticky top-0 z-[100] flex h-14 items-center gap-3 border-b border-[#E5DFD4] bg-white px-4 min-[900px]:px-6">
            <button
              type="button"
              aria-label="메뉴 열기"
              onClick={() => setIsDrawerOpen(true)}
              className="flex size-11 items-center justify-center rounded-md border border-[#E5DFD4] text-[#5C6B72] min-[900px]:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <h1 className="text-base font-extrabold tracking-[-0.4px]">
              {adminPageTitle(pathname)}
            </h1>

            <div className="ml-auto flex items-center gap-[9px]">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex h-[34px] items-center rounded-lg border border-[#E5DFD4] px-[13px] text-[12.5px] font-semibold text-[#5C6B72] hover:bg-[#F7F4EE]"
              >
                사이트 보기 ↗
              </a>
              {!isPropertyForm && (
                <Link
                  href="/admin/properties/new"
                  className="flex h-[34px] items-center gap-1.5 rounded-lg bg-[#146B7C] px-[15px] text-[12.5px] font-bold text-white hover:bg-[#115a69]"
                >
                  <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                  매물 등록
                </Link>
              )}
            </div>
          </header>

          <main id="admin-main" tabIndex={-1} className="flex-1 px-4 py-5 min-[900px]:px-6">
            <div className="w-full max-w-[1200px]">{children}</div>
          </main>

          {/* 하단 미니 법정 표기 — site_settings에 값이 생기면 자동 표시 */}
          {officeInfo && (
            <footer className="border-t border-[#E5DFD4] px-4 py-3.5 text-xs leading-[1.9] text-[#7C8990] min-[900px]:px-6">
              <p>
                {officeInfo.officeName} · 개업공인중개사 {officeInfo.ownerName} · 등록번호{" "}
                {officeInfo.registrationNumber} · {officeInfo.officePhone}
              </p>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
