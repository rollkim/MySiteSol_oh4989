import type { Metadata, Viewport } from "next";

import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";

/** SPEC §2: canonical·OG·sitemap이 모두 이 기준을 따른다 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oh4989.com";

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
const naverVerification = process.env.NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "오채영부동산 — 배곧 매물 지도로 찾기",
    template: "%s | 오채영부동산",
  },
  description:
    "시흥 배곧 아파트·오피스텔·원룸·상가 매물을 지도에서 바로 찾아보세요.",
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(naverVerification
      ? { other: { "naver-site-verification": naverVerification } }
      : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1c2e",
  width: "device-width",
  initialScale: 1,
  // 확대를 막지 않는다 — 40~60대 실수요자가 주 방문자다
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
