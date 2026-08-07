"use client";

import Link from "next/link";
import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import {
  BUILDING_TYPE_LABEL,
  INQUIRY_KIND_LABEL,
  INQUIRY_LOG_ACTION_LABEL,
  INQUIRY_SOURCE_LABEL,
  INQUIRY_STATUS,
  INQUIRY_STATUS_LABEL,
  type InquiryStatus,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/**
 * A4 상담 문의 — 확정 기획: 좌측 목록(탭) 430px / 우측 상세(연락·매물·본문·연락 이력·보관 안내).
 * 개인정보(이름·연락처)가 뜨는 유일한 화면이다. 공개면 어디에도 노출되지 않는다(RULE-11).
 * **삭제 기능 없음** — 보유 기간이 지나면 연락처만 자동 파기되고 통계·이력은 남는다.
 */

const STATUS_PILL: Record<InquiryStatus, { color: string; tint: string }> = {
  NEW: { color: "#C0392B", tint: "#FBEDEA" },
  IN_PROGRESS: { color: "#8A6A12", tint: "#FBF3DF" },
  VISIT_BOOKED: { color: "#146B7C", tint: "#EDF3F1" },
  DONE: { color: "#5C6B72", tint: "#F0ECE4" },
  SPAM: { color: "#7C8990", tint: "#F0ECE4" },
};

/** 접수일 + 보유 기간(3개월) = 파기 예정일 */
function purgeDueText(createdAt: Date): string {
  const dueAt = new Date(createdAt);
  dueAt.setMonth(dueAt.getMonth() + 3);
  return dueAt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function MemoEditor({ inquiryId, initialMemo }: { inquiryId: number; initialMemo: string | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [memo, setMemo] = useState(initialMemo ?? "");
  const updateMemo = useMutation(
    trpc.admin.inquiry.updateMemo.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.admin.inquiry.list.queryKey() }),
    }),
  );

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        updateMemo.mutate({ inquiryId, adminMemo: memo });
      }}
    >
      <label className="text-[12.5px] font-bold text-[#3C4C54]" htmlFor={`memo-${inquiryId}`}>
        내부 메모
      </label>
      <textarea
        id={`memo-${inquiryId}`}
        rows={3}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        maxLength={1000}
        placeholder="상담 내용·조건을 적어두세요. (연락처는 적지 마세요 — 파기 대상에서 빠집니다)"
        className="rounded-lg border border-[#D4CFC6] bg-white px-3 py-2 text-[13px] placeholder:text-[#A79E90]"
      />
      <button
        type="submit"
        disabled={updateMemo.isPending}
        className="flex h-11 w-fit items-center rounded-lg border border-[#D4CFC6] px-4 text-[12.5px] font-bold text-[#5C6B72] disabled:opacity-60"
      >
        {updateMemo.isPending ? "저장 중…" : "메모 저장"}
      </button>
    </form>
  );
}

function TimelineSection({ inquiryId }: { inquiryId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const logs = useQuery(trpc.admin.inquiry.logs.queryOptions({ inquiryId }));
  const [callMemo, setCallMemo] = useState("");
  const addLog = useMutation(
    trpc.admin.inquiry.addLog.mutationOptions({
      onSuccess: () => {
        setCallMemo("");
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.inquiry.logs.queryKey({ inquiryId }),
        });
      },
    }),
  );

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[12.5px] font-bold text-[#3C4C54]">연락 이력</h3>
      <ol className="flex flex-col gap-1.5">
        {logs.data?.map((log) => (
          <li key={log.id} className="flex gap-2.5 text-[12px]">
            <span className="num flex-none text-[#96A1A7]">
              {log.createdAt.toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="font-bold text-[#0B2430]">{INQUIRY_LOG_ACTION_LABEL[log.action]}</span>
            {log.memo && <span className="min-w-0 flex-1 text-[#5C6B72]">{log.memo}</span>}
          </li>
        ))}
        {logs.data?.length === 0 && <li className="text-[12px] text-[#96A1A7]">이력이 없습니다.</li>}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (callMemo.trim() === "") return;
          addLog.mutate({ inquiryId, action: "CALL_MEMO", memo: callMemo.trim() });
        }}
      >
        <input
          value={callMemo}
          onChange={(event) => setCallMemo(event.target.value)}
          maxLength={1000}
          placeholder="통화 메모 추가"
          className="h-11 min-w-0 flex-1 rounded-lg border border-[#D4CFC6] px-3 text-[13px] placeholder:text-[#A79E90]"
        />
        <button
          type="submit"
          disabled={addLog.isPending}
          className="flex h-11 flex-none items-center rounded-lg bg-[#0B2430] px-4 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          추가
        </button>
      </form>
    </section>
  );
}

export default function AdminInquiriesPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<"" | InquiryStatus>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const inquiryList = useQuery(
    trpc.admin.inquiry.list.queryOptions({ status: statusTab || undefined }),
  );
  const updateStatus = useMutation(
    trpc.admin.inquiry.updateStatus.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.admin.inquiry.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.admin.inquiry.newCount.queryKey() });
      },
    }),
  );
  const purge = useMutation(
    trpc.admin.inquiry.purgeExpiredContacts.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.admin.inquiry.list.queryKey() }),
    }),
  );

  const items = inquiryList.data?.items ?? [];
  const counts = inquiryList.data?.counts;
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const tabs: { tabLabel: string; value: "" | InquiryStatus; count?: number }[] = [
    { tabLabel: "전체", value: "", count: counts?.totalCount },
    { tabLabel: "신규", value: "NEW", count: counts?.newCount },
    { tabLabel: "연락중", value: "IN_PROGRESS", count: counts?.inProgressCount },
    { tabLabel: "방문 예약", value: "VISIT_BOOKED", count: counts?.visitBookedCount },
    { tabLabel: "완료", value: "DONE", count: counts?.doneCount },
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      {/* ── 좌측 목록 (확정 430px) ── */}
      <section className="w-full overflow-hidden rounded-xl border border-[#E5DFD4] bg-white lg:w-[430px] lg:flex-none">
        <div
          role="group"
          aria-label="문의 상태 탭"
          className="flex flex-wrap gap-1.5 border-b border-[#E5DFD4] px-4 py-2.5"
        >
          {tabs.map((tab) => {
            const isOn = statusTab === tab.value;
            return (
              <button
                key={tab.tabLabel}
                type="button"
                aria-pressed={isOn}
                onClick={() => setStatusTab(tab.value)}
                className={`flex min-h-11 items-center rounded-lg border px-3 text-[12.5px] font-bold ${
                  isOn
                    ? "border-[#0B2430] bg-[#0B2430] text-white"
                    : "border-[#D4CFC6] bg-white text-[#5C6B72]"
                }`}
              >
                {tab.tabLabel}
                {tab.count !== undefined && <span className="num ml-1">{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {inquiryList.isPending && <p className="px-4 py-8 text-sm text-[#96A1A7]">불러오는 중…</p>}
        {inquiryList.isSuccess && items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-[#7C8990]">해당 문의가 없습니다.</p>
        )}

        <ul className="max-h-[70dvh] overflow-y-auto">
          {items.map((inquiry) => {
            const isNew = inquiry.status === "NEW";
            const isSelected = selected?.id === inquiry.id;
            return (
              <li key={inquiry.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(inquiry.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col gap-1 border-b border-[#F0ECE4] px-4 py-3 text-left ${
                    isNew ? "border-l-[3px] border-l-[#146B7C] bg-[#F6FAF9]" : ""
                  } ${isSelected ? "bg-[#F1EEE8]" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="rounded-[5px] px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        color: STATUS_PILL[inquiry.status].color,
                        background: STATUS_PILL[inquiry.status].tint,
                      }}
                    >
                      {INQUIRY_STATUS_LABEL[inquiry.status]}
                    </span>
                    <b className="text-[13px] text-[#0B2430]">{inquiry.name ?? "(파기됨)"}</b>
                    {inquiry.inquiryKind && (
                      <span className="text-[11.5px] text-[#7C8990]">
                        {INQUIRY_KIND_LABEL[inquiry.inquiryKind]}
                      </span>
                    )}
                    <span className="num ml-auto text-[11px] text-[#96A1A7]">
                      {inquiry.createdAt.toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-[#5C6B72]">
                    {inquiry.message || "내용 없이 접수된 문의"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 우측 상세 ── */}
      <section className="min-w-0 flex-1 rounded-xl border border-[#E5DFD4] bg-white p-5">
        {selected ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold">{selected.name ?? "(연락처 파기됨)"}</h2>
              {selected.inquirySource && (
                <span className="rounded-[5px] bg-[#F0ECE4] px-2 py-0.5 text-[11px] font-semibold text-[#5C6B72]">
                  {INQUIRY_SOURCE_LABEL[selected.inquirySource]}
                </span>
              )}
              <span className="num ml-auto text-[12px] text-[#96A1A7]">
                {selected.createdAt.toLocaleString("ko-KR")}
              </span>
            </div>

            {/* 연락 — 파기 후에는 버튼 자체가 사라진다 */}
            {selected.phone !== null ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${selected.phone.replaceAll("-", "")}`}
                  className="num flex h-11 items-center rounded-lg bg-[#146B7C] px-4 text-[13px] font-bold text-white"
                >
                  전화 {selected.phone}
                </a>
                <a
                  href={`sms:${selected.phone.replaceAll("-", "")}`}
                  className="flex h-11 items-center rounded-lg border border-[#146B7C] px-4 text-[13px] font-bold text-[#146B7C]"
                >
                  문자 보내기
                </a>
              </div>
            ) : (
              <p className="rounded-lg bg-[#F0ECE4] px-3 py-2 text-[12.5px] text-[#5C6B72]">
                보유 기간이 지나 연락처가 파기되었습니다. 통계와 이력은 남아 있습니다.
              </p>
            )}

            {/* 문의한 매물 */}
            {selected.propertyId !== null && (
              <Link
                href={`/admin/properties/${selected.propertyId}/edit`}
                className="flex items-center gap-2 rounded-lg border border-[#E5DFD4] px-3 py-2.5 text-[13px] font-semibold text-[#0B2430] hover:bg-[#F7F4EE]"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {selected.propertyTitle ?? `매물 #${selected.propertyId}`}
              </Link>
            )}

            {/* 관심 조건 */}
            {(selected.interestDong || selected.interestBuildingType) && (
              <p className="text-[12.5px] text-[#5C6B72]">
                관심 조건: {selected.interestDong ?? "지역 무관"}
                {selected.interestBuildingType
                  ? ` · ${BUILDING_TYPE_LABEL[selected.interestBuildingType]}`
                  : ""}
              </p>
            )}

            {/* 본문 */}
            <p className="rounded-lg bg-[#FAF8F4] p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[#22343C]">
              {selected.message || "내용 없이 접수된 문의입니다."}
            </p>

            {/* 처리 상태 칩 */}
            <div role="group" aria-label="처리 상태" className="flex flex-wrap gap-1.5">
              {INQUIRY_STATUS.map((statusCode) => {
                const isOn = selected.status === statusCode;
                return (
                  <button
                    key={statusCode}
                    type="button"
                    aria-pressed={isOn}
                    disabled={updateStatus.isPending}
                    onClick={() =>
                      updateStatus.mutate({ inquiryId: selected.id, nextStatus: statusCode })
                    }
                    className={`flex min-h-11 items-center rounded-lg border px-3 text-[12.5px] font-bold disabled:opacity-60 ${
                      isOn
                        ? "border-[#146B7C] bg-[#EDF3F1] text-[#146B7C]"
                        : "border-[#D4CFC6] bg-white text-[#5C6B72]"
                    }`}
                  >
                    {INQUIRY_STATUS_LABEL[statusCode]}
                  </button>
                );
              })}
            </div>

            {/* key — 문의를 바꾸면 통화 메모 입력값도 함께 비운다(다른 문의 이력에 섞이지 않게) */}
            <TimelineSection key={selected.id} inquiryId={selected.id} />
            <MemoEditor key={selected.id} inquiryId={selected.id} initialMemo={selected.adminMemo} />

            {/* 개인정보 보관 카드 (확정: 네이비) */}
            <section className="rounded-xl bg-[#0B2430] p-4 text-white">
              <h3 className="text-[13px] font-extrabold">개인정보 보관</h3>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/80">
                {selected.contactPurgedAt
                  ? `${selected.contactPurgedAt.toLocaleDateString("ko-KR")}에 연락처가 파기되었습니다.`
                  : `이 문의는 ${purgeDueText(selected.createdAt)}에 연락처가 자동 파기됩니다(접수일로부터 3개월).`}
                <br />
                통계·이력은 남고 이름·연락처만 지워집니다. 삭제 기능은 제공하지 않습니다.
              </p>
              {selected.marketingConsentAt && (
                <p className="mt-1 text-[11.5px] text-white/60">
                  광고성 정보 수신 동의: {selected.marketingConsentAt.toLocaleDateString("ko-KR")}
                </p>
              )}
              <button
                type="button"
                disabled={purge.isPending}
                onClick={() => purge.mutate()}
                className="mt-3 flex h-11 items-center rounded-lg border border-white/30 px-4 text-[12.5px] font-bold text-[#CFE0E6] disabled:opacity-60"
              >
                {purge.isPending ? "파기 중…" : "기한 지난 연락처 지금 파기"}
              </button>
              {purge.data && (
                <p role="status" className="num mt-2 text-[12px] text-[#E8C87A]">
                  문의 {purge.data.purgedInquiryCount}건 · 등록 의뢰{" "}
                  {purge.data.purgedOwnerRequestCount}건 파기 완료(보유 {purge.data.retentionMonths}
                  개월)
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-[#7C8990]">문의를 선택하세요.</p>
        )}
      </section>
    </div>
  );
}
