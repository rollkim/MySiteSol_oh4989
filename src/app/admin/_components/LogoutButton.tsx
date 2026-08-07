"use client";

import { useRouter } from "next/navigation";

import { useMutation } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { useTRPC } from "@/trpc/client";

/**
 * 로그아웃 — 기본형(상단바 알약)과 사이드바형(확정 A0 프로필 행의 작은 텍스트 링크).
 * 사이드바형도 히트 영역은 44px을 지킨다(음수 마진으로 시각 크기만 유지).
 */
export function LogoutButton({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const trpc = useTRPC();
  const router = useRouter();
  const logout = useMutation(
    trpc.admin.auth.logout.mutationOptions({
      onSuccess: () => {
        router.refresh(); // 쿠키가 지워진 상태로 (authed) 레이아웃을 재평가시킨다
        router.replace("/admin/login");
      },
    }),
  );

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="-my-2 -ml-1 flex min-h-11 items-center px-1 text-left text-[10.5px] font-medium text-[#8FA4AD] hover:text-white disabled:opacity-60"
      >
        {logout.isPending ? "로그아웃 중…" : "로그아웃"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      className="flex h-10 items-center gap-1.5 rounded-full border border-[#E5DFD4] px-3.5 text-[13px] font-bold text-[#5C6B72] hover:bg-[#F7F4EE] disabled:opacity-60"
    >
      <LogOut className="size-4" strokeWidth={1.8} aria-hidden="true" />
      로그아웃
    </button>
  );
}
