import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "./context";

/**
 * tRPC 초기화 — 앱 전역에서 이 인스턴스 하나만 쓴다.
 *
 * transformer(superjson)는 v11 규약상 여기(서버)와 클라이언트 링크 **양쪽에** 지정한다.
 * Date 같은 값이 JSON 왕복에서 문자열로 뭉개지지 않게 직렬화를 대신한다.
 * 이 프로젝트에서는 `approvalDate`·`fieldCheckedAt`·`completedAt`이 전부 날짜라 실효가 크다.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * 누구나 호출 가능 — 매물 조회·지도 검색·문의 접수.
 * 비회원 전용 사이트라 **이쪽이 기본값**이고, 공개면의 거의 모든 프로시저가 여기에 속한다.
 */
export const publicProcedure = t.procedure;

/**
 * 관리자 전용 — 매물 등록·수정, 문의 관리, 환경설정.
 *
 * 공개 화면에는 로그인 UI가 없고 관리자는 `/admin`으로 직접 들어온다.
 * 세션 판독은 Phase 1에서 채운다.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.adminUserId === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "관리자 권한이 필요합니다.",
    });
  }
  // adminUserId가 null이 아님을 하위 프로시저 타입에 좁혀 전달한다
  return next({ ctx: { adminUserId: ctx.adminUserId } });
});
