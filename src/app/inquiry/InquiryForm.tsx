"use client";

import Link from "next/link";
import { useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { MAP_REGIONS } from "@/domain/map";
import {
  BUILDING_TYPE_LABEL,
  BUILDING_TYPES,
  INQUIRY_KIND_LABEL,
  INQUIRY_KINDS,
  type BuildingType,
  type InquiryKind,
} from "@/lib/codes";
import type { OfficeInfo } from "@/server/services/site-settings.service";
import { useTRPC } from "@/trpc/client";

/**
 * 문의 폼 — 확정안 M5. 동의는 **2종 분리**(필수 개인정보 / 선택 광고성 — 법정, 묶기 금지).
 * 필수 동의 없이는 제출 버튼이 눌리지 않고, 서버(zod literal(true))가 한 번 더 막는다.
 * 보유 기간 3개월은 개인정보처리방침(/privacy)·관리자 자동파기와 한 몸 — 함께만 바꾼다.
 */
export function InquiryForm({
  propertyId,
  officeInfo,
}: {
  propertyId: number | null;
  officeInfo: OfficeInfo | null;
}) {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [inquiryKind, setInquiryKind] = useState<InquiryKind>("FIND");
  const [interestDong, setInterestDong] = useState("");
  const [interestBuildingType, setInterestBuildingType] = useState<"" | BuildingType>("");
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const createInquiry = useMutation(trpc.inquiry.create.mutationOptions());

  if (createInquiry.isSuccess) {
    return (
      <div className="rounded-lg bg-surface-alt p-8 text-center">
        <p className="text-lg font-bold">상담 신청이 접수되었습니다 ✓</p>
        <p className="mt-2 text-sm text-ink-70">
          확인 후 남겨주신 연락처로 빠르게 연락드리겠습니다.
        </p>
      </div>
    );
  }

  const fieldClass =
    "min-h-[46px] rounded-[10px] border border-[#E0DACF] bg-[#FBFAF7] px-[13px] text-sm font-medium text-ink placeholder:text-[#A79E90]";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (createInquiry.isPending || !privacyConsent) return;
        createInquiry.mutate({
          propertyId,
          name,
          phone,
          message,
          inquiryKind,
          interestDong: interestDong || null,
          interestBuildingType: interestBuildingType || null,
          privacyConsent: true,
          marketingConsent,
        });
      }}
    >
      {/* 확정 M5 안내문 — 구어체 원문 */}
      <p className="text-[12.5px] leading-[1.55] font-semibold text-[#5C6B72]">
        찾으시는 조건만 남겨주세요. 확인하는 대로 연락드립니다. 보통{" "}
        <b className="font-extrabold text-ink">2시간 안에</b> 회신드립니다.
      </p>

      <label className="flex flex-col gap-1.5 text-[11.5px] font-bold text-[#5C6B72]">
        <span>
          이름 <span aria-hidden className="text-[#C2410C]">*</span>
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={40}
          autoComplete="name"
          placeholder="성함을 입력해주세요"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[11.5px] font-bold text-[#5C6B72]">
        <span>
          연락처 <span aria-hidden className="text-[#C2410C]">*</span>
        </span>
        <input
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          placeholder="010-0000-0000"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={`num ${fieldClass}`}
        />
      </label>

      {/* 문의 유형 칩 3종 (확정 M5) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[11.5px] font-bold text-[#5C6B72]">
          문의 유형 <span aria-hidden className="text-[#C2410C]">*</span>
        </legend>
        <div role="group" aria-label="문의 유형" className="flex gap-1.5">
          {INQUIRY_KINDS.map((kindCode) => {
            const selected = inquiryKind === kindCode;
            return (
              <button
                key={kindCode}
                type="button"
                aria-pressed={selected}
                onClick={() => setInquiryKind(kindCode)}
                className={`flex h-11 flex-1 items-center justify-center rounded-[9px] border text-[12.5px] font-bold transition-colors ${
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-[#E0DACF] bg-surface text-[#5C6B72]"
                }`}
              >
                {INQUIRY_KIND_LABEL[kindCode]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 관심 지역 · 매물 유형 (선택) */}
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11.5px] font-bold text-[#5C6B72]">
          관심 지역
          <select
            value={interestDong}
            onChange={(event) => setInterestDong(event.target.value)}
            className={fieldClass}
          >
            <option value="">선택 안 함</option>
            {MAP_REGIONS.map((region) => (
              <option key={region.label} value={region.label}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11.5px] font-bold text-[#5C6B72]">
          매물 유형
          <select
            value={interestBuildingType}
            onChange={(event) => setInterestBuildingType(event.target.value as "" | BuildingType)}
            className={fieldClass}
          >
            <option value="">선택 안 함</option>
            {BUILDING_TYPES.map((buildingType) => (
              <option key={buildingType} value={buildingType}>
                {BUILDING_TYPE_LABEL[buildingType]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-[11.5px] font-bold text-[#5C6B72]">
        내용
        {/* 확정 M5에 필수 별표가 없다 — 유형 칩·관심 지역이 이미 조건을 담으므로 진입 장벽을 낮춘다 */}
        <textarea
          name="message"
          maxLength={2000}
          rows={4}
          placeholder="예) 20평 안팎 1층 카페 자리 찾습니다. 보증금 3천 이하면 좋겠어요."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="rounded-[10px] border border-[#E0DACF] bg-[#FBFAF7] px-[13px] py-2.5 text-sm font-medium text-ink placeholder:text-[#A79E90]"
        />
      </label>

      {/* 동의 2종 — 확정 M5: 필수/선택을 절대 묶지 않는다(법정).
          각 동의는 항목·목적·보유기간·거부권을 **각각** 고지한다(개인정보보호법 §22 구분 고지).
          고지 문구는 /privacy 표와 한 몸 — 한쪽만 바꾸면 고지 불일치가 된다. */}
      <div className="flex flex-col gap-2.5 pt-0.5">
        <label className="flex min-h-11 items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
            className="mt-0.5 size-[19px] accent-[#0B2430]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] leading-[1.45] font-semibold text-[#22343C]">
                <b className="font-extrabold text-[#C2410C]">[필수]</b> 개인정보 수집·이용에
                동의합니다
              </span>
              {/* 새 탭 — 같은 탭으로 이동하면 작성 중인 폼 내용이 전부 날아간다 */}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="-mr-3 flex min-h-11 min-w-11 flex-none items-center justify-center px-3 text-[11px] font-semibold text-ink-70 underline underline-offset-2"
              >
                전문
              </Link>
            </span>
            <span className="mt-0.5 block text-[11px] leading-[1.5] font-medium text-[#5C6B72]">
              수집항목 이름·연락처·문의 내용(관심 지역·매물 유형)·접속 IP(스팸 방지) / 목적 상담
              회신 / 보유 접수일로부터 3개월 · 동의를 거부하실 수 있으나 폼 접수가 어렵습니다(전화
              상담은 가능).
            </span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(event) => setMarketingConsent(event.target.checked)}
            className="mt-0.5 size-[19px] accent-[#0B2430]"
          />
          <span className="min-w-0 flex-1">
            <span className="text-[11.5px] leading-[1.45] font-semibold text-[#22343C]">
              <b className="font-extrabold text-[#5C6B72]">[선택]</b> 매물·소식 등 광고성 정보
              수신에 동의합니다
            </span>
            <span className="mt-0.5 block text-[11px] leading-[1.5] font-medium text-[#5C6B72]">
              수집항목 연락처 / 목적 매물·소식 안내 / 보유 동의 철회 시까지 · 동의하지 않으셔도
              상담 이용에 제한이 없습니다.
            </span>
          </span>
        </label>
      </div>

      {createInquiry.isError && (
        <p id="inquiry-submit-error" role="alert" className="text-sm text-alert">
          {createInquiry.error.message}
        </p>
      )}

      {/* 확정 M5 제출 — h 50px, 틸 채움 */}
      <button
        type="submit"
        disabled={createInquiry.isPending || !privacyConsent}
        aria-describedby={createInquiry.isError ? "inquiry-submit-error" : undefined}
        className="h-[50px] rounded-[11px] bg-accent text-[15px] font-extrabold text-white disabled:opacity-50"
      >
        {createInquiry.isPending ? "보내는 중…" : "상담 신청하기"}
      </button>

      {/* 확정 M5 하단 — 전화가 더 빠릅니다 + 카카오톡(있을 때) */}
      {officeInfo && (
        <div className="flex items-center gap-2">
          <span className="flex-none text-[11.5px] font-semibold text-ink-40">
            전화가 더 빠릅니다
          </span>
          <a
            href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
            className="num flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-[9px] border-[1.5px] border-ink text-[12.5px] font-extrabold text-ink"
          >
            ☏ {officeInfo.officePhone}
          </a>
          {officeInfo.kakaoChannelUrl && (
            <a
              href={officeInfo.kakaoChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-[84px] flex-none items-center justify-center rounded-[9px] bg-gold text-[12.5px] font-extrabold text-ink"
            >
              카카오톡
            </a>
          )}
        </div>
      )}
    </form>
  );
}
