"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTRPC } from "@/trpc/client";

/**
 * 관리자 로그인 — 공개 화면에는 이 페이지로 오는 링크가 없다(비회원 전용, RULE-11).
 * 관리자 팔레트(명율 그레이 + #2563eb)로 그린다. 셸은 로그인 뒤에만 붙는다.
 */
export default function AdminLoginPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation(
    trpc.admin.auth.login.mutationOptions({
      onSuccess: () => {
        // (authed) 레이아웃이 쿠키를 다시 읽도록 서버 렌더를 강제한다
        router.refresh();
        router.replace("/admin");
      },
    }),
  );

  const inputClass =
    "h-11 w-full rounded-[9px] border border-[#d0d5dd] bg-white px-3 text-[14px] text-[#101828] placeholder:text-[#98a2b3] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#101828] p-6">
      <div className="w-full max-w-sm rounded-[14px] border border-[#e4e7ec] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,.25)]">
        <p className="text-[15px] font-extrabold tracking-[-.2px]">
          oh4989 <span className="font-semibold text-[#98a2b3]">관리자</span>
        </p>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!login.isPending) login.mutate({ loginId, password });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">아이디</span>
            <input
              type="text"
              name="loginId"
              autoComplete="username"
              required
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">비밀번호</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </label>
          {login.isError && (
            <p role="alert" className="text-[13px] font-medium text-[#d92d20]">
              {login.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={login.isPending}
            className="h-11 rounded-[9px] bg-[#2563eb] text-[14.5px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {login.isPending ? "확인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
