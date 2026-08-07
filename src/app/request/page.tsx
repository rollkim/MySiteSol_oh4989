import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { getServerCaller } from "@/server/trpc/caller";

import { RequestForm } from "./RequestForm";

export const metadata: Metadata = {
  title: "매물 내놓기",
  description: "배곧 매물 등록 의뢰 — 연락처만 남기시면 방문·상담해 드립니다.",
};

/** 매물 등록 의뢰 (SPEC §2 /request) — 집주인용 접수 폼 */
export default async function OwnerRequestPage() {
  const caller = await getServerCaller();
  const officeInfo = await caller.siteSetting.officeInfo();

  return (
    <>
    <main className="mx-auto max-w-md p-6 pb-16">
      <h1 className="text-xl font-bold">매물 내놓기</h1>
      <p className="mt-1 text-sm text-ink-40">
        내놓으실 매물 정보를 남겨주세요. 확인 후 연락드립니다.
      </p>
      <div className="mt-6">
        <RequestForm />
      </div>

      {officeInfo && (
        <p className="mt-8 text-center text-sm text-ink-70">
          전화가 편하시면{" "}
          <a
            href={`tel:${officeInfo.officePhone.replaceAll("-", "")}`}
            className="font-bold text-accent"
          >
            ☎ {officeInfo.officePhone}
          </a>
        </p>
      )}
    </main>
    <SiteFooter officeInfo={officeInfo} />
    </>
  );
}
