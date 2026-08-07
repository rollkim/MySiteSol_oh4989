"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 유튜브 파사드 — 클릭 전에는 썸네일만(임베드 ~1MB를 M4/PC3 이중 렌더에서 두 번 받지 않는다).
 * 재생 중 브랜치가 숨겨지면(뷰포트 전환) 0-크기를 감지해 iframe을 내려 고아 오디오를 막는다.
 */
export function VideoEmbed({ youTubeId, videoTitle }: { youTubeId: string; videoTitle: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const box = boxRef.current;
    if (!box) return;
    // 브랜치가 display:none으로 숨겨지면(뷰포트 전환) iframe을 내려 고아 오디오를 막는다.
    // ResizeObserver는 display:none 전환에서 콜백이 안 오는 것을 실측 — IO + offsetParent로 판정.
    // (offsetParent 조건: 스크롤로 화면 밖에 나간 것만으로는 재생을 끊지 않기 위해)
    const intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting && box.offsetParent === null) setIsPlaying(false);
    });
    intersectionObserver.observe(box);
    return () => intersectionObserver.disconnect();
  }, [isPlaying]);

  return (
    <div ref={boxRef} className="relative aspect-video overflow-hidden rounded-md bg-ink">
      {isPlaying ? (
        <iframe
          src={`https://www.youtube.com/embed/${youTubeId}?autoplay=1`}
          title={videoTitle}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`${videoTitle} 재생`}
          className="group absolute inset-0 h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 썸네일(next/image 미도입 방침) */}
          <img
            src={`https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90"
          />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 pl-1 text-xl text-white">
              ▶
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
