import {
  FOOTER_BRAND_LINES,
  FOOTER_BRAND_TAGLINE,
  FOOTER_CALL_NOTE_LINES,
  PUBLIC_AGENCY_LINKS,
  WORDMARK_ALT,
} from "@/lib/brand";
import type { OfficeInfo } from "@/server/services/site-settings.service";

/**
 * 공개면 공통 푸터 — 확정안 PC4 **비주얼형**(네이비 배경 · 공공기관 바로가기 포함).
 * 법정정보(공인중개사법 §18의2): 명칭·소재지·연락처·등록번호·개업공인중개사 성명 5종 전부 표기.
 * ⚠️ 중개보조원 정보는 표기 금지 — 필드 자체를 두지 않는다(RULE-11).
 * 값은 site_settings(officeInfo)가 단일 출처이며, 선택 필드는 없으면 그 줄을 숨긴다.
 */

function InfoRow({ rowLabel, children }: { rowLabel: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[12.5px] leading-[1.55]">
      <span className="w-[62px] flex-none font-semibold text-[#7EA3AE]">{rowLabel}</span>
      <span className="min-w-0 text-[#DCE6E9]">{children}</span>
    </div>
  );
}

function ContactChip({ chipLetter }: { chipLetter: string }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 flex-none items-center justify-center rounded-[5px] bg-white/10 text-[10px] font-extrabold text-[#8ECBD8]"
    >
      {chipLetter}
    </span>
  );
}

export function SiteFooter({ officeInfo }: { officeInfo: OfficeInfo | null }) {
  return (
    <footer className="bg-ink text-white">
      {/* ── 공공기관 바로가기 (확정안: 실제로 연결되는 외부 링크) ── */}
      <section className="border-b border-white/10 px-5 py-9 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-[1368px]">
          <div className="mb-5 flex items-end justify-between gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold tracking-[0.16em] text-gold">
                QUICK LINKS
              </span>
              <h2 className="text-[19px] font-extrabold tracking-[-0.6px] text-white lg:text-2xl lg:tracking-[-0.9px]">
                공공기관 바로가기
              </h2>
            </div>
            <span className="hidden text-[13px] text-white/60 sm:block">
              계약 전 직접 확인하실 수 있게 모아뒀습니다
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_AGENCY_LINKS.map((agency) => (
              <a
                key={agency.linkName}
                href={agency.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/5 px-[19px] py-[17px] transition-colors duration-150 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold tracking-[-0.3px] text-white">
                      {agency.linkName}
                    </span>
                    <span className="text-[11px] font-semibold text-gold">{agency.linkKind}</span>
                  </div>
                  <span aria-hidden className="text-xs text-white/45">
                    ↗
                  </span>
                </div>
                <span className="text-[13px] text-white/75">{agency.linkDesc}</span>
                <span className="text-[11.5px] text-white/40">{agency.linkHost}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사무소 정보 4열 (모바일은 세로 적층) ── */}
      <section className="px-5 py-9 lg:px-12 lg:py-10">
        <div className="mx-auto grid max-w-[1368px] gap-9 lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:gap-10">
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md) */}
            <img
              src="/brand/ohc-wordmark-white.png"
              alt={officeInfo?.officeName ?? WORDMARK_ALT}
              width={311}
              height={51}
              className="h-[18px] w-auto self-start"
            />
            <span className="text-[12.5px] font-semibold text-[#7EA3AE]">
              {FOOTER_BRAND_TAGLINE}
            </span>
            <p className="text-[13.5px] leading-[1.75] text-white/80 [text-wrap:pretty]">
              {FOOTER_BRAND_LINES[0]}
              <br />
              {FOOTER_BRAND_LINES[1]}
            </p>
            {(officeInfo?.youtubeUrl || officeInfo?.blogUrl) && (
              <div className="mt-0.5 flex flex-wrap gap-2">
                {officeInfo?.youtubeUrl && (
                  <a
                    href={officeInfo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-[34px] items-center gap-1.5 rounded-lg border border-white/20 px-[13px] text-xs font-bold text-white transition-colors duration-150 hover:bg-white/10"
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                    유튜브 · 친절한 채영씨
                  </a>
                )}
                {officeInfo?.blogUrl && (
                  <a
                    href={officeInfo.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-[34px] items-center rounded-lg border border-white/20 px-[13px] text-xs font-bold text-white transition-colors duration-150 hover:bg-white/10"
                  >
                    네이버 블로그
                  </a>
                )}
              </div>
            )}
          </div>

          {officeInfo ? (
            <>
              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-extrabold tracking-[-0.2px] text-white">
                  사무소 정보
                </h3>
                <div className="flex flex-col gap-[9px]">
                  <InfoRow rowLabel="상호">{officeInfo.officeName}</InfoRow>
                  <InfoRow rowLabel="대표">개업공인중개사 {officeInfo.ownerName}</InfoRow>
                  <InfoRow rowLabel="주소">{officeInfo.officeAddress}</InfoRow>
                  <InfoRow rowLabel="개설등록">
                    <span className="num">{officeInfo.registrationNumber}</span>
                  </InfoRow>
                  {officeInfo.businessRegistrationNumber && (
                    <InfoRow rowLabel="사업자">
                      <span className="num">{officeInfo.businessRegistrationNumber}</span>
                    </InfoRow>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-extrabold tracking-[-0.2px] text-white">연락처</h3>
                <div className="flex flex-col gap-2.5">
                  <a
                    href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
                    className="flex min-h-11 items-center gap-[9px]"
                  >
                    <ContactChip chipLetter="T" />
                    <span className="num text-sm font-bold text-white">
                      {officeInfo.officePhone}
                    </span>
                  </a>
                  {officeInfo.mobilePhone && (
                    <a
                      href={`tel:${officeInfo.mobilePhone.replaceAll("-", "")}`}
                      className="flex min-h-11 items-center gap-[9px]"
                    >
                      <ContactChip chipLetter="M" />
                      <span className="num text-sm font-bold text-white">
                        {officeInfo.mobilePhone}
                      </span>
                    </a>
                  )}
                  {officeInfo.faxNumber && (
                    <div className="flex items-center gap-[9px]">
                      <ContactChip chipLetter="F" />
                      <span className="num text-[13.5px] font-semibold text-[#DCE6E9]">
                        {officeInfo.faxNumber}
                      </span>
                    </div>
                  )}
                  {officeInfo.kakaoChannelUrl && (
                    <a
                      href={officeInfo.kakaoChannelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex h-11 items-center justify-center rounded-lg bg-gold text-[13px] font-bold text-ink"
                    >
                      카카오톡 상담하기
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {(officeInfo.businessHoursMain || officeInfo.businessHoursNotes?.length) && (
                  <>
                    <h3 className="text-[13px] font-extrabold tracking-[-0.2px] text-white">
                      영업시간
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      {officeInfo.businessHoursMain && (
                        <span className="num text-lg font-extrabold tracking-[-0.5px] text-white">
                          {officeInfo.businessHoursMain}
                        </span>
                      )}
                      {officeInfo.businessHoursNotes?.map((hoursNote) => (
                        <span key={hoursNote} className="text-[12.5px] leading-[1.7] text-white/65">
                          {hoursNote}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div className="mt-1 rounded-[9px] border border-white/10 bg-white/5 px-3.5 py-3">
                  <p className="text-xs leading-[1.6] font-semibold text-white/80">
                    {FOOTER_CALL_NOTE_LINES[0]}
                    <br />
                    {FOOTER_CALL_NOTE_LINES[1]}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-white/60 lg:col-span-3">중개사무소 정보 준비 중</p>
          )}
        </div>
      </section>

      {/* ── 바닥 바 — 확정안: © 줄 + 개인정보처리방침 + 등록·대표 표기 ── */}
      <div className="border-t border-white/10 px-5 py-4 lg:px-12">
        <div className="mx-auto flex max-w-[1368px] flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-white/45">
            © {new Date().getFullYear()}
            {officeInfo ? ` ${officeInfo.officeName}` : ""}. All rights reserved.
          </span>
          <span className="flex flex-wrap items-center gap-4">
            <a
              href="/privacy"
              className="flex min-h-11 items-center text-xs font-extrabold text-white underline underline-offset-[3px]"
            >
              개인정보처리방침
            </a>
            {officeInfo && (
              <span className="text-xs text-white/45">
                개설등록 <span className="num">{officeInfo.registrationNumber}</span> · 대표{" "}
                {officeInfo.ownerName}
              </span>
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}
