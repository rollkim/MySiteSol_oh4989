import { Phone } from "lucide-react";

import { OWNER_QUOTE, PROFILE_ALT, TRUST_BODY_LINES, TRUST_TITLE } from "@/lib/brand";
import type { OfficeInfo } from "@/server/services/site-settings.service";

/**
 * M1 대표 신뢰 블록 — 대표 사진(원형) + 구어체 카피 + 전화 CTA.
 * 카피는 다듬지 않는다(핸드오프 주의). 전화번호는 officeInfo(site_settings)에서.
 */
export function TrustBlock({ officeInfo }: { officeInfo: OfficeInfo | null }) {
  return (
    <section className="px-5 pt-6">
      <div className="flex flex-col gap-3.5 rounded-[13px] border border-[#EFEAE0] bg-surface p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
          <img
            src="/brand/ohc-profile.jpg"
            alt={officeInfo ? `대표 ${officeInfo.ownerName}` : PROFILE_ALT}
            className="h-10 w-10 flex-none rounded-full object-cover [object-position:50%_22%]"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-extrabold tracking-[-0.3px] text-ink">{TRUST_TITLE}</p>
            <p className="text-[12.5px] leading-[1.6] text-ink-70">
              {TRUST_BODY_LINES[0]}
              <br />
              {TRUST_BODY_LINES[1]}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-40">{OWNER_QUOTE}</p>
          </div>
        </div>
        {officeInfo && (
          <a
            href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
            className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-ink text-sm font-extrabold text-white"
          >
            <Phone size={14} strokeWidth={2.4} aria-hidden />
            전화 상담 <span className="num">{officeInfo.officePhone}</span>
          </a>
        )}
      </div>
    </section>
  );
}
