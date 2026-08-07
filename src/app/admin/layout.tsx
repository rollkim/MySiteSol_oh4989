import type { Metadata } from "next";

/**
 * /admin/** 공통 레이아웃 — 검색엔진 차단(noindex)만 담당한다.
 * 세션 확인은 (authed) 그룹 레이아웃이 한다 — 로그인 페이지는 그룹 밖이라
 * 리다이렉트 루프가 생기지 않는다.
 */
export const metadata: Metadata = {
  title: "oh4989 관리자",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
