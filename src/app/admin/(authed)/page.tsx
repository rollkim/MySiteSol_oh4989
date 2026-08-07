"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { useQuery } from "@tanstack/react-query";

import { formatPropertyPrice } from "@/domain/price";
import {
  PROPERTY_DEAL_PROGRESS_LABEL,
  PROPERTY_VISIBILITY_LABEL,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/**
 * A1 대시보드 — 확정 기획: KPI 4장 → [오늘 할 일 | 이번 주 많이 본 매물] → 최근 등록 6장.
 * "대표가 매일 볼 것은 새 문의와 노출 만료 임박 둘뿐 — 나머지 둘은 참고용이라 색을 죽였습니다"(기획).
 */

function KpiCard({
  kpiLabel,
  kpiValue,
  kpiUnit,
  kpiSub,
  toneColor,
}: {
  kpiLabel: string;
  kpiValue: number;
  kpiUnit: string;
  kpiSub: string;
  toneColor: string;
}) {
  return (
    <div className="flex flex-col gap-[7px] rounded-xl border border-[#E5DFD4] bg-white px-[18px] py-4">
      <span className="text-xs font-bold text-[#7C8990]">{kpiLabel}</span>
      <span className="flex items-baseline gap-[5px]">
        <b
          className="num text-[30px] leading-none font-extrabold tracking-[-1.2px]"
          style={{ color: toneColor }}
        >
          {kpiValue.toLocaleString("ko-KR")}
        </b>
        <span className="text-[13px] font-bold text-[#96A1A7]">{kpiUnit}</span>
      </span>
      <span className="text-[11.5px] leading-[1.5] text-[#96A1A7]">{kpiSub}</span>
    </div>
  );
}

/** 오늘 할 일 행 — 유형별 색 규칙: 문의=적색 틴트 / 만료=골드 점 / 사진 누락=모래 점 (기획 확정) */
function TodoRow({
  dotColor,
  rowBg,
  rowBorder,
  todoTitle,
  todoSub,
  todoTime,
  ctaLabel,
  ctaHref,
}: {
  dotColor: string;
  rowBg: string;
  rowBorder: string;
  todoTitle: string;
  todoSub: string;
  todoTime: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-[10px] border px-[13px] py-[11px]"
      style={{ background: rowBg, borderColor: rowBorder }}
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: dotColor }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[#0B2430]">{todoTitle}</span>
        <span className="block truncate text-[11.5px] text-[#7C8990]">{todoSub}</span>
      </span>
      {todoTime && <span className="num flex-none text-[11px] font-semibold text-[#96A1A7]">{todoTime}</span>}
      <Link
        href={ctaHref}
        className="flex h-[29px] flex-none items-center rounded-[7px] bg-[#0B2430] px-3 text-[11.5px] font-bold text-white"
      >
        {ctaLabel}
      </Link>
    </li>
  );
}

function relativeTimeText(dateValue: Date): string {
  const elapsedMs = Date.now() - dateValue.getTime();
  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  if (hours < 1) return "방금";
  if (hours < 24) return `${hours}시간 전`;
  return dateValue.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

/** 오늘 날짜 (기획 상단 보조 표기) — 서버에서는 빈 문자열로 두어 hydration 불일치를 피한다 */
const subscribeNoop = () => () => {};
const todayLabel = () =>
  new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

export default function AdminDashboardPage() {
  const trpc = useTRPC();
  const summary = useQuery(trpc.admin.dashboard.summary.queryOptions());
  const todayText = useSyncExternalStore(subscribeNoop, todayLabel, () => "");

  if (summary.isPending) {
    return <p className="text-sm text-[#96A1A7]">불러오는 중…</p>;
  }
  if (summary.isError) {
    return (
      <p role="alert" className="text-sm text-[#C0392B]">
        대시보드를 불러오지 못했습니다: {summary.error.message}
      </p>
    );
  }

  const { kpi, todoInquiries, noPhotoCount, popular, recent } = summary.data;
  const maxWeekViews = Math.max(1, ...popular.map((row) => row.weekViews));
  const weeklyDeltaText =
    kpi.previousWeekViewCount > 0
      ? `지난주 대비 ${kpi.weeklyViewCount >= kpi.previousWeekViewCount ? "+" : ""}${Math.round(((kpi.weeklyViewCount - kpi.previousWeekViewCount) / kpi.previousWeekViewCount) * 100)}%`
      : "집계는 도입일부터 쌓입니다";
  const oldestText = kpi.oldestNewInquiryAt
    ? `가장 오래된 건 ${relativeTimeText(new Date(kpi.oldestNewInquiryAt))}`
    : "미처리 문의 없음";

  return (
    <div className="flex flex-col gap-[18px]">
      {todayText && <p className="num -mb-2 text-[12.5px] text-[#7C8990]">{todayText}</p>}

      {/* ① KPI 4장 — 새 문의·만료 임박만 색을 살린다(기획) */}
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard
          kpiLabel="새 상담 문의"
          kpiValue={kpi.newInquiryCount}
          kpiUnit="건"
          kpiSub={oldestText}
          toneColor="#C0392B"
        />
        <KpiCard
          kpiLabel="노출 만료 임박"
          kpiValue={kpi.expiringSoonCount}
          kpiUnit="건"
          kpiSub="등록 90일 지난 매물 — 확인 필요"
          toneColor="#8A6A12"
        />
        <KpiCard
          kpiLabel="공개 중인 매물"
          kpiValue={kpi.visibleCount}
          kpiUnit="건"
          kpiSub={`상가 ${kpi.storeCount} · 아파트 ${kpi.aptCount} · 오피스텔 ${kpi.officetelCount}`}
          toneColor="#0B2430"
        />
        <KpiCard
          kpiLabel="이번 주 조회"
          kpiValue={kpi.weeklyViewCount}
          kpiUnit="회"
          kpiSub={weeklyDeltaText}
          toneColor="#146B7C"
        />
      </div>

      {/* ② 오늘 할 일 | 이번 주 많이 본 매물 */}
      <div className="flex flex-col items-stretch gap-3.5 lg:flex-row">
        <section className="min-w-0 flex-[1.32] rounded-xl border border-[#E5DFD4] bg-white px-5 py-[18px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-[-0.3px]">오늘 할 일</h2>
            <Link href="/admin/inquiries" className="text-xs font-bold text-[#146B7C]">
              전체 보기 →
            </Link>
          </div>
          <ul className="mt-[13px] flex flex-col gap-[9px]">
            {todoInquiries.map((inquiry) => (
              <TodoRow
                key={inquiry.id}
                dotColor="#C0392B"
                rowBg="#FBEDEA"
                rowBorder="#F3D9D3"
                todoTitle={`${inquiry.name ?? "(파기됨)"} 님${inquiry.propertyId !== null ? ` — 매물 #${inquiry.propertyId}` : ""}`}
                todoSub={inquiry.message || "내용 없이 접수된 문의"}
                todoTime={relativeTimeText(inquiry.createdAt)}
                ctaLabel="확인"
                ctaHref="/admin/inquiries"
              />
            ))}
            {kpi.expiringSoonCount > 0 && (
              <TodoRow
                dotColor="#E8C87A"
                rowBg="#FBF9F4"
                rowBorder="#EFEAE0"
                todoTitle={`노출 만료 임박 ${kpi.expiringSoonCount}건`}
                todoSub="가격이 그대로인지 확인하고 연장하세요"
                todoTime="오늘"
                ctaLabel="확인"
                ctaHref="/admin/properties"
              />
            )}
            {noPhotoCount > 0 && (
              <TodoRow
                dotColor="#C9C0B0"
                rowBg="#FBF9F4"
                rowBorder="#EFEAE0"
                todoTitle={`사진 없는 매물 ${noPhotoCount}건`}
                todoSub="사진 없는 매물은 문의가 1/5로 떨어집니다"
                todoTime=""
                ctaLabel="보기"
                ctaHref="/admin/properties"
              />
            )}
            {todoInquiries.length === 0 && kpi.expiringSoonCount === 0 && noPhotoCount === 0 && (
              <li className="rounded-[10px] border border-[#EFEAE0] bg-[#FBF9F4] px-[13px] py-[11px] text-[12.5px] text-[#7C8990]">
                오늘 처리할 일이 없습니다.
              </li>
            )}
          </ul>
        </section>

        <section className="min-w-0 flex-1 rounded-xl border border-[#E5DFD4] bg-white px-5 py-[18px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-[-0.3px]">이번 주 많이 본 매물</h2>
            <span className="text-[11.5px] text-[#96A1A7]">7일</span>
          </div>
          {popular.length > 0 ? (
            <ul className="mt-[13px] flex flex-col gap-[11px]">
              {popular.map((row) => (
                <li key={row.propertyId} className="flex flex-col gap-[5px]">
                  <span className="flex items-baseline justify-between gap-2.5">
                    <span className="truncate text-[12.5px] font-semibold text-[#22343C]">
                      {row.title}
                    </span>
                    <b className="num flex-none text-xs font-extrabold text-[#146B7C]">
                      {row.weekViews}
                    </b>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-[3px] bg-[#F0ECE4]">
                    <span
                      className="block h-1.5 rounded-[3px] bg-[#146B7C]"
                      style={{ width: `${Math.round((row.weekViews / maxWeekViews) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[13px] text-[12.5px] leading-[1.6] text-[#7C8990]">
              아직 이번 주 조회 기록이 없습니다. 집계는 도입일부터 쌓입니다.
            </p>
          )}
        </section>
      </div>

      {/* ③ 최근 등록한 매물 6장 */}
      <section className="rounded-xl border border-[#E5DFD4] bg-white px-5 py-[18px]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-[-0.3px]">최근 등록한 매물</h2>
          <Link href="/admin/properties" className="text-xs font-bold text-[#146B7C]">
            매물 관리로 →
          </Link>
        </div>
        {recent.length > 0 ? (
          <ul className="mt-[13px] grid grid-cols-2 gap-3 min-[700px]:grid-cols-3 xl:grid-cols-6">
            {recent.map((property) => {
              const isHidden = property.listingVisibility === "HIDDEN";
              const isCompleted = property.dealProgress === "COMPLETED";
              return (
                <li key={property.id}>
                  <Link href={`/admin/properties/${property.id}/edit`} className="flex flex-col gap-[7px]">
                    <span className="relative block aspect-[4/3] overflow-hidden rounded-[9px] bg-[#EFEAE0]">
                      {property.thumbPath ? (
                        // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
                        <img
                          src={`/uploads/${property.thumbPath}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] font-semibold text-[#A79E90]">
                          사진 없음
                        </span>
                      )}
                      {/* 상태 배지 — 색+텍스트 병행. 숨김·거래완료만 표시(공개·거래중이 기본값) */}
                      {(isHidden || isCompleted) && (
                        <span
                          className="absolute top-[7px] left-[7px] rounded-[4px] px-1.5 py-[3px] text-[10px] leading-none font-extrabold text-white"
                          style={{ background: isHidden ? "#7C8990" : "#8A6A12" }}
                        >
                          {isHidden
                            ? PROPERTY_VISIBILITY_LABEL.HIDDEN
                            : PROPERTY_DEAL_PROGRESS_LABEL.COMPLETED}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs font-bold text-[#0B2430]">{property.title}</span>
                    <span className="num text-[11px] text-[#7C8990]">
                      {formatPropertyPrice(property)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-[13px] text-[12.5px] text-[#7C8990]">
            아직 등록된 매물이 없습니다. 우상단 &ldquo;매물 등록&rdquo;으로 시작하세요.
          </p>
        )}
      </section>
    </div>
  );
}
