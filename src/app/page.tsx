"use client";

/**
 * ⚠️ 임시 화면 — Phase 3에서 실제 홈(세로 영상 레일 + 지도 프리뷰 + 추천 매물)으로 교체된다.
 * 지금은 ① 디자인 토큰·서체가 물렸는지 ② tRPC 왕복이 되는지를 눈으로 확인하는 용도만 한다.
 * (실제 홈은 서버 컴포넌트가 된다. 이 파일이 "use client"인 건 확인 편의 때문이다)
 */

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

const swatches = [
  ["ink", "bg-ink"],
  ["ink-70", "bg-ink-70"],
  ["ink-40", "bg-ink-40"],
  ["line", "bg-line"],
  ["surface-alt", "bg-surface-alt"],
  ["accent", "bg-accent"],
  ["accent-soft", "bg-accent-soft"],
  ["alert", "bg-alert"],
] as const;

export default function Home() {
  const trpc = useTRPC();
  const health = useQuery(trpc.health.ping.queryOptions());

  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-xs text-ink-40">Phase 0-2·0-3 확인용 임시 화면</p>
      <h1 className="mt-1 text-xl font-bold">오채영부동산</h1>

      <section className="mt-6">
        <h2 className="text-xs font-medium text-ink-40">tRPC 왕복</h2>
        <p
          className="mt-1 text-sm"
          data-testid="health"
          data-status={health.status}
        >
          {health.isPending && "확인 중…"}
          {health.isError && (
            <span className="text-alert">실패: {health.error.message}</span>
          )}
          {health.data && (
            <>
              ok · 서버 시각{" "}
              <span className="num">
                {health.data.at.toLocaleTimeString("ko-KR")}
              </span>{" "}
              <span className="text-ink-40">
                (Date 타입 유지: {health.data.at instanceof Date ? "예" : "아니오"})
              </span>
            </>
          )}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-medium text-ink-40">색 (§5-2)</h2>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {swatches.map(([name, bg]) => (
            <div key={name}>
              <div
                className={`h-12 rounded-md border border-line ${bg}`}
                aria-hidden
              />
              <span className="mt-1 block text-[11px] text-ink-70">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-medium text-ink-40">
          서체 (§5-3) — 숫자는 Wanted Sans, 한글은 Pretendard로 떨어져야 함
        </h2>
        <p className="num mt-2 text-[32px] font-bold tracking-[-0.02em]">
          4억 3,000
        </p>
        <p className="num text-xl font-bold">월세 500/45</p>
        <p className="mt-1 text-sm text-ink-70">
          원룸 · 전용 20㎡ · 3/3층 · 남향(안방 기준)
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-medium text-ink-40">
          형태·그림자 (§5-4, §5-5)
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-sm bg-accent-soft px-2 py-1 text-xs text-accent">
            필터 칩
          </span>
          <span className="rounded-md bg-surface px-3 py-2 text-xs shadow-float">
            지도 위 부유 요소
          </span>
          <span
            className="num bg-ink px-2 py-1 text-[13px] font-bold text-white"
            style={{ borderRadius: "var(--radius-marker)" }}
          >
            3.6억
          </span>
        </div>
      </section>
    </main>
  );
}
