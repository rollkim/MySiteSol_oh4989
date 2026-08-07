"use client";

import { useRouter } from "next/navigation";

import { ChevronLeft } from "lucide-react";

/**
 * 모바일 상세 상단 뒤로가기 오버레이 — 사진 위에 떠 있는 44px 원형 버튼.
 * 지도·목록·홈 어디서 왔든 이전 화면으로(히스토리가 없으면 목록으로).
 */
export function BackOverlay() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="이전 화면으로"
      onClick={() => {
        // history.length는 forward·타 사이트 엔트리를 포함해 "이전 엔트리 존재"와 다르다 —
        // Navigation API(canGoBack)가 있으면 그 값을, 없으면 length 근사를 쓴다
        const navigationApi = (window as { navigation?: { canGoBack?: boolean } }).navigation;
        const canGoBack = navigationApi?.canGoBack ?? window.history.length > 1;
        if (canGoBack) router.back();
        else router.push("/properties");
      }}
      className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-[2px]"
    >
      <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
    </button>
  );
}
