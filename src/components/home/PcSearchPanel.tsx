"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAP_REGIONS } from "@/domain/map";
import { POPULAR_SEARCH_KEYWORDS } from "@/lib/brand";
import { DEAL_TYPE_LABEL, DEAL_TYPES, type BuildingType, type DealType } from "@/lib/codes";

/**
 * PC1 히어로 검색 패널 — 확정안 S안(유형 탭 + 조건 행 + 「검색 →」 + 많이 찾는 조건).
 * 조건은 /map 딥링크(bt/dt/rg/kw)로 넘긴다.
 * ⚠️ 시안의 보증금·월세·면적 범위 필드는 mapSearch 서버 필터가 아직 없어
 *    키워드 입력으로 대체했다 — 범위 필터는 지도 확장 반복에서 서버와 함께 추가한다.
 */
const SEARCH_TYPE_TABS: { tabLabel: string; buildingTypes: BuildingType[] }[] = [
  { tabLabel: "상가", buildingTypes: ["STORE"] },
  { tabLabel: "아파트", buildingTypes: ["APT"] },
  { tabLabel: "오피스텔", buildingTypes: ["OFFICETEL"] },
  { tabLabel: "원룸·투룸", buildingTypes: ["ONE_ROOM", "TWO_ROOM"] },
  { tabLabel: "토지·건물", buildingTypes: ["LAND", "DETACHED"] },
];

export function PcSearchPanel() {
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(0);
  const [regionLabel, setRegionLabel] = useState("");
  const [dealType, setDealType] = useState<"" | DealType>("");
  const [keywordDraft, setKeywordDraft] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("bt", SEARCH_TYPE_TABS[tabIndex].buildingTypes.join(","));
    if (dealType) params.set("dt", dealType);
    if (regionLabel) params.set("rg", regionLabel);
    const keyword = keywordDraft.trim();
    if (keyword) params.set("kw", keyword);
    router.push(`/map?${params.toString()}`);
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-[15px] border border-[#EAE5DC] bg-surface px-6 pt-5 pb-[22px] shadow-[0_18px_44px_rgba(11,36,48,0.16)]">
      <div className="flex items-center justify-between">
        {/* 필터 버튼 그룹 — 전환되는 패널이 없으므로 tabs 패턴이 아니라 aria-pressed 칩(지도 화면과 동일) */}
        <div role="group" aria-label="매물 유형" className="flex gap-[7px]">
          {SEARCH_TYPE_TABS.map((typeTab, index) => {
            const selected = index === tabIndex;
            return (
              <button
                key={typeTab.tabLabel}
                type="button"
                aria-pressed={selected}
                onClick={() => setTabIndex(index)}
                className={`flex h-9 items-center rounded-[19px] border px-4 text-[13.5px] font-bold transition-colors duration-150 xl:h-10 xl:px-5 xl:text-[14.5px] ${
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-[#EAE5DC] bg-surface text-[#5C6B72] hover:border-ink-40"
                }`}
              >
                {typeTab.tabLabel}
              </button>
            );
          })}
        </div>
        <Link href="/map" className="text-[12.5px] font-bold text-accent">
          지도로 찾기 →
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-[11px]">
        <label className="flex min-w-0 flex-[0.9] flex-col gap-[5px]">
          <span className="text-[11px] font-bold tracking-[0.02em] text-ink-40">지역</span>
          <select
            value={regionLabel}
            onChange={(event) => setRegionLabel(event.target.value)}
            className="h-[46px] rounded-[9px] border border-[#EAE5DC] bg-surface px-3 text-sm font-semibold text-ink xl:h-[52px] xl:text-[15px]"
          >
            <option value="">전체 지역</option>
            {MAP_REGIONS.map((region) => (
              <option key={region.label} value={region.label}>
                시흥시 {region.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[0.7] flex-col gap-[5px]">
          <span className="text-[11px] font-bold tracking-[0.02em] text-ink-40">거래유형</span>
          <select
            value={dealType}
            onChange={(event) => setDealType(event.target.value as "" | DealType)}
            className="h-[46px] rounded-[9px] border border-[#EAE5DC] bg-surface px-3 text-sm font-semibold text-ink xl:h-[52px] xl:text-[15px]"
          >
            <option value="">전체</option>
            {DEAL_TYPES.map((code) => (
              <option key={code} value={code}>
                {DEAL_TYPE_LABEL[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1.6] flex-col gap-[5px]">
          <span className="text-[11px] font-bold tracking-[0.02em] text-ink-40">건물명 · 단지</span>
          <input
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            placeholder="예) 아브뉴프랑 · 1층 코너"
            className="h-[46px] rounded-[9px] border border-[#EAE5DC] bg-surface px-[13px] text-sm font-semibold text-ink placeholder:font-medium placeholder:text-[#A79E90] xl:h-[52px] xl:text-[15px]"
          />
        </label>
        <button
          type="submit"
          className="flex h-[46px] w-[126px] flex-none items-center justify-center gap-2 rounded-[9px] bg-ink text-[15px] font-extrabold text-white xl:h-[52px] xl:w-[140px] xl:text-base"
        >
          검색 <span aria-hidden className="text-[13px]">→</span>
        </button>
      </form>

      <div className="flex items-center gap-[9px] border-t border-[#EFEAE0] pt-3.5">
        <span className="flex-none text-xs font-bold text-ink-40">많이 찾는 조건</span>
        <div className="flex flex-wrap gap-[7px]">
          {POPULAR_SEARCH_KEYWORDS.map((popularKeyword) => (
            <Link
              key={popularKeyword}
              href={`/map?kw=${encodeURIComponent(popularKeyword)}`}
              className="flex h-[31px] items-center rounded-2xl border border-[#EAE5DC] px-3 text-[12.5px] font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              {popularKeyword}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
