"use client";

import Link from "next/link";
import { useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { DEAL_TYPE_LABEL, DEAL_TYPES, type DealType } from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/** 매물 등록 의뢰 폼 — 집주인용. 주소는 대략만 받고 상담 전화에서 확정한다 */
export function RequestForm() {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressHint, setAddressHint] = useState("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const createRequest = useMutation(trpc.ownerRequest.create.mutationOptions());

  if (createRequest.isSuccess) {
    return (
      <div className="rounded-lg bg-surface-alt p-8 text-center">
        <p className="text-lg font-bold">의뢰가 접수되었습니다 ✓</p>
        <p className="mt-2 text-sm text-ink-70">
          확인 후 연락드려 매물 정보를 자세히 안내받겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (createRequest.isPending || !privacyConsent) return;
        createRequest.mutate({
          name,
          phone,
          addressHint: addressHint.trim() === "" ? null : addressHint,
          dealType: dealType === "" ? null : dealType,
          message: message.trim() === "" ? null : message,
          privacyConsent: true,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        성함
        <input
          type="text"
          name="name"
          required
          maxLength={40}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        연락처
        <input
          type="tel"
          name="phone"
          required
          maxLength={20}
          autoComplete="tel"
          placeholder="010-0000-0000"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        매물 위치 (대략)
        <input
          type="text"
          name="addressHint"
          maxLength={200}
          placeholder="예: 배곧동 ○○상가 1층 / 아브뉴프랑 인근"
          value={addressHint}
          onChange={(event) => setAddressHint(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3"
        />
        <span className="text-xs text-ink-40">정확한 주소는 상담 전화에서 확인합니다.</span>
      </label>
      <fieldset>
        <legend className="text-sm">희망 거래유형 (선택)</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {DEAL_TYPES.map((dealTypeCode) => {
            const isSelected = dealType === dealTypeCode;
            return (
              <button
                key={dealTypeCode}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setDealType(isSelected ? "" : dealTypeCode)}
                className={`min-h-11 rounded-md border px-4 text-sm ${
                  isSelected
                    ? "border-accent bg-accent-soft font-bold text-accent"
                    : "border-line bg-surface text-ink-70"
                }`}
              >
                {DEAL_TYPE_LABEL[dealTypeCode]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        전하실 내용 (선택)
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          placeholder="면적, 희망 가격, 입주 가능 시기 등을 적어주시면 상담이 빨라집니다."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5"
        />
      </label>

      <label className="flex min-h-11 items-start gap-2 rounded-md bg-surface-alt p-3 text-sm">
        <input
          type="checkbox"
          checked={privacyConsent}
          onChange={(event) => setPrivacyConsent(event.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <b>개인정보 수집·이용 동의 (필수)</b>
            {/* 새 탭 — 같은 탭 이동은 작성 중인 폼을 날린다 */}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="-mr-2 flex min-h-11 min-w-11 flex-none items-center justify-center px-2 text-xs font-semibold text-ink-70 underline underline-offset-2"
            >
              전문
            </Link>
          </span>
          <span className="mt-0.5 block text-xs text-ink-70">
            수집 항목: 성함·연락처·매물 위치·희망 거래유형·전하실 내용·접속 IP(도용·스팸 방지) ·
            이용 목적: 매물 등록 상담 · 보유 기간: 접수일로부터 3개월(개인정보처리방침과 동일).
            동의를 거부할 권리가 있으며, 거부 시 폼 접수는 어렵지만 전화(하단 안내)로 상담하실 수
            있습니다.
          </span>
        </span>
      </label>

      {createRequest.isError && (
        <p id="request-submit-error" role="alert" className="text-sm text-alert">
          {createRequest.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={createRequest.isPending || !privacyConsent}
        aria-describedby={createRequest.isError ? "request-submit-error" : undefined}
        className="min-h-11 rounded-md bg-accent font-medium text-white disabled:opacity-50"
      >
        {createRequest.isPending ? "보내는 중…" : "등록 의뢰하기"}
      </button>
    </form>
  );
}
