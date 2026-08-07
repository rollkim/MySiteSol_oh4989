"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  DEAL_TYPE_LABEL,
  OWNER_REQUEST_STATUS,
  OWNER_REQUEST_STATUS_LABEL,
  type OwnerRequestStatus,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/** 관리자 등록의뢰함 — 접수 목록·상태(신규→연락함→매물 등록됨/반려)·메모 */

const STATUS_PILL: Record<OwnerRequestStatus, { color: string; tint: string; border: string }> = {
  NEW: { color: "#d92d20", tint: "#fef3f2", border: "#fecdca" },
  CONTACTED: { color: "#b54708", tint: "#fffaeb", border: "#fedf89" },
  REGISTERED: { color: "#039855", tint: "#f6fef9", border: "#a6f4c5" },
  DECLINED: { color: "#667085", tint: "#f2f4f7", border: "#e4e7ec" },
};

function MemoEditor({
  ownerRequestId,
  initialMemo,
  onSaved,
}: {
  ownerRequestId: number;
  initialMemo: string | null;
  onSaved: () => void;
}) {
  const trpc = useTRPC();
  const [memoText, setMemoText] = useState(initialMemo ?? "");
  const updateMemo = useMutation(
    trpc.admin.ownerRequest.updateMemo.mutationOptions({ onSuccess: onSaved }),
  );
  return (
    <div className="mt-2 flex items-start gap-1.5">
      <textarea
        aria-label="상담 메모"
        rows={2}
        value={memoText}
        onChange={(event) => setMemoText(event.target.value)}
        placeholder="상담 메모 (관리자만 보입니다)"
        className="min-h-9 flex-1 rounded-[7px] border border-[#e4e7ec] bg-[#f9fafb] px-2.5 py-1.5 text-xs text-[#344054] placeholder:text-[#98a2b3] focus:border-[#2563eb] focus:outline-none"
      />
      <button
        type="button"
        disabled={updateMemo.isPending}
        onClick={() => updateMemo.mutate({ ownerRequestId, adminMemo: memoText })}
        className="h-9 rounded-[7px] border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-[#475467] hover:bg-[#f2f4f7] disabled:opacity-60"
      >
        메모 저장
      </button>
    </div>
  );
}

export default function AdminOwnerRequestsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const requestList = useQuery(trpc.admin.ownerRequest.list.queryOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.admin.ownerRequest.list.queryKey() });
  const updateStatus = useMutation(
    trpc.admin.ownerRequest.updateStatus.mutationOptions({ onSuccess: invalidate }),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[#667085]">
        총 <b className="text-[#101828]">{requestList.data?.length ?? 0}</b>건
        {requestList.data && (
          <>
            {" "}
            · 신규{" "}
            <b className="text-[#d92d20]">
              {requestList.data.filter((request) => request.status === "NEW").length}
            </b>
            건
          </>
        )}
      </p>

      {requestList.isPending && <p className="text-sm text-[#98a2b3]">불러오는 중…</p>}
      {requestList.isError && (
        <p role="alert" className="text-sm text-[#d92d20]">
          {requestList.error.message}
        </p>
      )}
      {requestList.data && requestList.data.length === 0 && (
        <div className="rounded-[14px] border border-[#e4e7ec] bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <p className="text-sm text-[#667085]">아직 접수된 등록 의뢰가 없습니다.</p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {requestList.data?.map((request) => {
          const pill = STATUS_PILL[request.status];
          return (
            <li
              key={request.id}
              className="rounded-[14px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                  style={{
                    color: pill.color,
                    background: pill.tint,
                    border: `1px solid ${pill.border}`,
                  }}
                >
                  {OWNER_REQUEST_STATUS_LABEL[request.status]}
                </span>
                <b className="text-sm">{request.name ?? "(파기됨)"}</b>
                {/* 연락처 null = 3개월 경과 자동 파기(개인정보처리방침 §2) */}
                {request.phone !== null ? (
                  <a
                    href={`tel:${request.phone.replaceAll("-", "")}`}
                    className="num text-sm text-[#2563eb]"
                  >
                    {request.phone}
                  </a>
                ) : (
                  <span className="text-sm text-[#98a2b3]">연락처 파기됨</span>
                )}
                {request.dealType && (
                  <span className="rounded-[5px] bg-[#eff4ff] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#2563eb]">
                    {DEAL_TYPE_LABEL[request.dealType]}
                  </span>
                )}
                <span className="ml-auto text-xs text-[#98a2b3]">
                  {request.createdAt.toLocaleString("ko-KR")}
                </span>
                <label className="sr-only" htmlFor={`request-status-${request.id}`}>
                  상태 변경
                </label>
                <select
                  id={`request-status-${request.id}`}
                  value={request.status}
                  disabled={updateStatus.isPending}
                  onChange={(event) =>
                    updateStatus.mutate({
                      ownerRequestId: request.id,
                      nextStatus: event.target.value as OwnerRequestStatus,
                    })
                  }
                  className="h-8 rounded-[7px] border border-[#d0d5dd] bg-white px-2 text-xs font-semibold text-[#344054]"
                >
                  {OWNER_REQUEST_STATUS.map((statusCode) => (
                    <option key={statusCode} value={statusCode}>
                      {OWNER_REQUEST_STATUS_LABEL[statusCode]}
                    </option>
                  ))}
                </select>
              </div>
              {request.addressHint && (
                <p className="mt-2 text-sm font-semibold text-[#344054]">
                  📍 {request.addressHint}
                </p>
              )}
              {request.message && (
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-[#344054]">
                  {request.message}
                </p>
              )}
              <MemoEditor
                ownerRequestId={request.id}
                initialMemo={request.adminMemo}
                onSaved={invalidate}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
