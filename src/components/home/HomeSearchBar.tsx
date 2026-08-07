"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Search } from "lucide-react";

import { MAP_REGIONS } from "@/domain/map";
import { HERO_SEARCH_PLACEHOLDER } from "@/lib/brand";

/**
 * M1 히어로 검색바 — 확정값 h 50px / radius 13px / 흰 배경 / 그림자.
 * 지역명(배곧동 등)이면 지도 이동(rg), 그 외는 건물명 키워드 검색(kw)으로 딥링크한다.
 */
export function HomeSearchBar() {
  const router = useRouter();
  const [searchDraft, setSearchDraft] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchDraft.trim();
    if (!query) {
      router.push("/map");
      return;
    }
    const region = MAP_REGIONS.find((candidate) => candidate.label === query);
    router.push(
      region
        ? `/map?rg=${encodeURIComponent(region.label)}`
        : `/map?kw=${encodeURIComponent(query)}`,
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-[50px] items-center gap-2 rounded-[13px] bg-surface pl-[15px] shadow-[0_6px_18px_rgba(0,0,0,0.22)] focus-within:ring-2 focus-within:ring-accent"
    >
      <Search size={16} className="flex-none text-[#5C6B72]" aria-hidden />
      <input
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder={HERO_SEARCH_PLACEHOLDER}
        aria-label="매물 검색"
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:text-[#9AA6AC]"
      />
      <button
        type="submit"
        className="flex h-full min-w-11 items-center justify-center px-3 text-[13.5px] font-bold text-accent"
      >
        검색
      </button>
    </form>
  );
}
