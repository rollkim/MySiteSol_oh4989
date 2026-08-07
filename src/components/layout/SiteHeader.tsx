import Link from "next/link";

import { Phone } from "lucide-react";

import { HEADER_TAGLINE, WORDMARK_ALT } from "@/lib/brand";
import type { OfficeInfo } from "@/server/services/site-settings.service";

/**
 * 공개면 상단 헤더 — 확정안 M1(56px 네이비 + 워드마크 + 전화 버튼) /
 * PC1(72px 흰 배경 + GNB + 전화번호 + 상담 버튼).
 * 전화번호는 site_settings(officeInfo)에서 온다 — 하드코딩 금지(RULE-11 리스킨).
 */
export function SiteHeader({ officeInfo }: { officeInfo: OfficeInfo | null }) {
  const telHref = officeInfo ? `tel:${officeInfo.officePhone.replaceAll("-", "")}` : null;
  const kakaoUrl = officeInfo?.kakaoChannelUrl;

  return (
    <header>
      {/* 모바일 — 확정안 M1 헤더 */}
      <div className="flex h-14 items-center justify-between bg-ink pr-3 pl-4 lg:hidden">
        <Link href="/" className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
          <img
            src="/brand/ohc-wordmark-white.png"
            alt={officeInfo?.officeName ?? WORDMARK_ALT}
            width={311}
            height={51}
            className="h-[19px] w-auto"
          />
          <span className="text-[10.5px] leading-none tracking-[0.02em] text-[#7EA3AE]">
            {HEADER_TAGLINE}
          </span>
        </Link>
        {telHref && officeInfo && (
          <a
            href={telHref}
            aria-label={`전화 걸기 ${officeInfo.officePhone}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/10">
              <Phone size={16} strokeWidth={2.2} aria-hidden />
            </span>
          </a>
        )}
      </div>

      {/* PC — 확정안 PC1 헤더 */}
      <div className="hidden h-[72px] items-center justify-between border-b border-[#EFEAE0] bg-surface px-12 lg:flex">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
            <img
              src="/brand/ohc-wordmark.png"
              alt={officeInfo?.officeName ?? WORDMARK_ALT}
              width={311}
              height={51}
              className="h-[22px] w-auto"
            />
          </Link>
          <nav aria-label="주 메뉴" className="flex gap-[26px]">
            <Link href="/map?bt=STORE" className="text-[14.5px] font-bold text-ink">
              상가
            </Link>
            <Link href="/map?bt=APT" className="text-[14.5px] font-semibold text-[#5C6B72]">
              아파트
            </Link>
            <Link href="/map?bt=OFFICETEL" className="text-[14.5px] font-semibold text-[#5C6B72]">
              오피스텔
            </Link>
            <Link href="/map" className="text-[14.5px] font-semibold text-[#5C6B72]">
              지도
            </Link>
            <Link href="/inquiry" className="text-[14.5px] font-semibold text-[#5C6B72]">
              상담 문의
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {telHref && officeInfo && (
            <a href={telHref} className="num text-base font-extrabold text-ink">
              {officeInfo.officePhone}
            </a>
          )}
          {kakaoUrl ? (
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center rounded-[9px] bg-ink px-[18px] text-[13.5px] font-bold text-white"
            >
              카톡 상담
            </a>
          ) : (
            <Link
              href="/inquiry"
              className="flex h-10 items-center rounded-[9px] bg-ink px-[18px] text-[13.5px] font-bold text-white"
            >
              상담 문의
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
