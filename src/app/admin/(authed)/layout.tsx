import { redirect } from "next/navigation";

import { readAdminSessionUserId } from "@/server/auth/admin-session";
import { getServerCaller } from "@/server/trpc/caller";

import { AdminShell } from "../_components/AdminShell";

/**
 * 로그인이 필요한 관리자 화면의 공통 셸.
 * 서버에서 세션을 확인하고 비로그인은 로그인 화면으로 보낸다 — 로그인 페이지는
 * 이 그룹 밖에 있어 리다이렉트 루프가 없고, 비로그인자에게 메뉴 구조가 노출되지 않는다
 * (PaRaSOL admin layout의 "셸은 로그인 뒤에만" 원칙).
 */
export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUserId = await readAdminSessionUserId();
  if (adminUserId === null) redirect("/admin/login");

  const caller = await getServerCaller();
  const officeInfo = await caller.siteSetting.officeInfo();

  return <AdminShell officeInfo={officeInfo}>{children}</AdminShell>;
}
