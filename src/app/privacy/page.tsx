import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteTabBar } from "@/components/layout/SiteTabBar";
import { getServerCaller } from "@/server/trpc/caller";

/**
 * 개인정보처리방침 (개인정보보호법 §30) — 문의(M5)·등록 의뢰 폼의 "전문" 링크와
 * 전 페이지 푸터가 여기로 연결된다.
 * ⚠️ 보유 기간 3개월은 문의 폼 캡션·관리자 자동파기(기획 A4)와 한 몸 — 반드시 함께 바꾼다.
 */
export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "오채영부동산 개인정보처리방침 — 수집 항목·목적·보유 기간 안내.",
};

const EFFECTIVE_DATE = "2026년 8월 7일";

function PolicySection({
  sectionTitle,
  children,
}: {
  sectionTitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-extrabold tracking-[-0.3px] text-ink">{sectionTitle}</h2>
      <div className="text-[13px] leading-[1.75] text-ink-70 [text-wrap:pretty]">{children}</div>
    </section>
  );
}

export default async function PrivacyPolicyPage() {
  const caller = await getServerCaller();
  const officeInfo = await caller.siteSetting.officeInfo();
  const officeName = officeInfo?.officeName ?? "중개사무소";

  return (
    <div className="min-h-dvh bg-surface pb-16 lg:pb-0">
      <SiteHeader officeInfo={officeInfo} />
      <main className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-8">
        <div>
          <h1 className="text-xl font-extrabold tracking-[-0.5px] text-ink">개인정보처리방침</h1>
          <p className="mt-1 text-xs text-ink-40">시행일 {EFFECTIVE_DATE}</p>
        </div>

        <PolicySection sectionTitle="1. 총칙">
          <p>
            {officeName}
            {officeInfo && ` (대표 ${officeInfo.ownerName})`}는 매물 상담을 위해 필요한 최소한의
            개인정보만을 수집하며, 개인정보보호법 등 관련 법령을 준수합니다. 이 사이트는 회원가입이
            없으며, 개인정보는 아래 폼 접수 시에만 수집됩니다.
          </p>
        </PolicySection>

        <PolicySection sectionTitle="2. 수집 항목 · 목적 · 보유 기간">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-ink">
                  <th className="py-2 pr-3 font-bold">구분</th>
                  <th className="py-2 pr-3 font-bold">수집 항목</th>
                  <th className="py-2 pr-3 font-bold">이용 목적</th>
                  <th className="py-2 font-bold">보유 기간</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-line">
                  <td className="py-2 pr-3">상담 문의</td>
                  <td className="py-2 pr-3">
                    이름 · 연락처 · 문의 내용(문의 유형 · 관심 지역 · 매물 유형 포함) · 접속
                    IP(스팸 방지)
                  </td>
                  <td className="py-2 pr-3">매물 상담 회신</td>
                  <td className="py-2">접수일로부터 3개월 후 연락처 자동 파기</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 pr-3">매물 등록 의뢰</td>
                  <td className="py-2 pr-3">
                    이름 · 연락처 · 매물 소재지 · 희망 거래 조건 · 전하실 내용 · 접속 IP
                  </td>
                  <td className="py-2 pr-3">등록 상담 진행</td>
                  <td className="py-2">접수일로부터 3개월 후 연락처 자동 파기</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">[선택] 광고성 정보 수신</td>
                  <td className="py-2 pr-3">연락처</td>
                  <td className="py-2 pr-3">매물 · 소식 안내</td>
                  <td className="py-2">동의 철회 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            필수 항목의 수집·이용에 동의하지 않을 권리가 있으며, 동의하지 않는 경우 폼 접수는
            어렵지만 전화로 상담하실 수 있습니다. 선택 항목(광고성 정보 수신)에 동의하지 않아도
            상담 이용에 제한이 없습니다.
          </p>
          <p className="mt-2">
            보유 기간이 지나면 이름·연락처·접속 IP를 지우고, 문의 내용과 상담 메모에 적힌
            전화번호도 함께 가립니다. 개인을 알아볼 수 없게 된 문의 내용·처리 이력은 상담 품질
            관리와 분쟁 대응을 위해 남습니다.
          </p>
        </PolicySection>

        <PolicySection sectionTitle="3. 제3자 제공 및 처리 위탁">
          <p>
            수집한 개인정보를 제3자에게 제공하거나 외부에 처리 위탁하지 않습니다. 법령에 따라
            수사기관 등이 적법하게 요구하는 경우는 예외로 합니다.
          </p>
        </PolicySection>

        <PolicySection sectionTitle="4. 파기 절차">
          <p>
            보유 기간이 지난 개인정보(연락처)는 지체 없이 복구할 수 없는 방법으로 파기합니다.
            상담 통계 등 개인을 식별할 수 없는 정보는 파기 후에도 남을 수 있습니다.
          </p>
        </PolicySection>

        <PolicySection sectionTitle="5. 정보주체의 권리">
          <p>
            본인의 개인정보에 대해 열람·정정·삭제·처리 정지를 언제든 요구할 수 있고, 광고성 정보
            수신 동의는 언제든 철회할 수 있습니다. 아래 연락처로 요청해 주시면 지체 없이
            처리합니다.
          </p>
        </PolicySection>

        <PolicySection sectionTitle="6. 개인정보 보호책임자">
          {officeInfo ? (
            <p>
              {officeInfo.officeName} · 대표 {officeInfo.ownerName}
              <br />
              {officeInfo.officeAddress}
              <br />
              전화 <span className="num">{officeInfo.officePhone}</span>
            </p>
          ) : (
            <p>중개사무소 정보 준비 중</p>
          )}
        </PolicySection>

        {/* ⚠️ 아래 조치는 실제로 구현된 것만 적는다 — 허위 기재는 그 자체가 위반이다 */}
        <PolicySection sectionTitle="7. 안전성 확보 조치">
          <ul className="list-disc space-y-1 pl-4">
            <li>관리자 비밀번호는 복호화할 수 없는 방식으로 암호화해 저장합니다.</li>
            <li>
              관리자 접속에는 브라우저 스크립트가 읽을 수 없는 보안 쿠키를 사용하고, 로그인 시도
              횟수를 제한합니다.
            </li>
            <li>모든 통신은 HTTPS로 암호화합니다.</li>
            <li>개인정보에 접근할 수 있는 사람은 개업공인중개사 본인으로 한정합니다.</li>
          </ul>
        </PolicySection>

        <PolicySection sectionTitle="8. 권익침해 구제 방법">
          <p>
            개인정보 침해로 도움이 필요하시면 아래 기관에 문의하실 수 있습니다.
            <br />
            개인정보침해신고센터 (privacy.kisa.or.kr / 국번 없이 118)
            <br />
            개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)
            <br />
            대검찰청 사이버수사과 (spo.go.kr / 1301) · 경찰청 사이버수사국 (ecrm.police.go.kr /
            182)
          </p>
        </PolicySection>

        <PolicySection sectionTitle="9. 방침의 변경">
          <p>
            이 방침의 내용이 추가·삭제·수정될 경우 시행 7일 전부터 이 페이지를 통해 알려드립니다.
            다만 이용자 권리에 중대한 영향을 주는 변경은 30일 전에 알려드립니다.
          </p>
        </PolicySection>
      </main>
      <SiteFooter officeInfo={officeInfo} />
      <SiteTabBar />
    </div>
  );
}
