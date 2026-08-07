"use client";

import { useRef, useState } from "react";

/**
 * 매물 사진 캐러셀 (확정안 M4 §1) — 4:3, 가로 스크롤 스냅 + 인디케이터.
 * 전체화면 갤러리는 Phase 3. 스냅은 CSS가 하고 JS는 현재 위치 표시만 한다 —
 * prefers-reduced-motion 사용자도 기본 스크롤이라 문제가 없다.
 */
export function PhotoCarousel({
  images,
  title,
}: {
  images: { id: number; filePath: string }[];
  title: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCurrentIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-alt text-sm text-ink-70">
        등록된 사진이 없습니다
      </div>
    );
  }

  const scrollToIndex = (targetIndex: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(images.length - 1, targetIndex));
    scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
        aria-label={`${title} 사진 ${images.length}장`}
      >
        {images.map((image, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- next/image 미도입 방침(AGENTS.md)
          <img
            key={image.id}
            src={`/uploads/${image.filePath}`}
            alt={`${title} 사진 ${index + 1}`}
            className="h-full w-full flex-none snap-center object-cover"
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      {/* 키보드·클릭으로 넘길 수 있는 유일한 수단 — 스크롤 제스처가 없는 사용자용 */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 사진"
            onClick={() => scrollToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/55 text-lg text-white disabled:opacity-30"
          >
            ‹<span className="sr-only"> 이전 사진</span>
          </button>
          <button
            type="button"
            aria-label="다음 사진"
            onClick={() => scrollToIndex(currentIndex + 1)}
            disabled={currentIndex === images.length - 1}
            className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/55 text-lg text-white disabled:opacity-30"
          >
            ›<span className="sr-only"> 다음 사진</span>
          </button>
        </>
      )}
      <span className="num absolute right-3 bottom-3 rounded-sm bg-ink/70 px-2 py-0.5 text-xs text-white">
        {currentIndex + 1}/{images.length}
      </span>
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
          {images.map((image, index) => (
            <span
              key={image.id}
              className={`h-1.5 w-1.5 rounded-full ${index === currentIndex ? "bg-white" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
