import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

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
  /**
   * 사용자에게 나가는 메시지를 여기서 한 번에 통제한다.
   * ① zod 검증 실패 → 첫 이슈의 한국어 메시지 한 줄(이슈 배열 JSON 원문 노출 차단)
   * ② 예상 밖 서버 오류 → 일반 안내문. tRPC는 비-TRPCError를 감쌀 때 cause.message를
   *    그대로 상속하므로, 손대지 않으면 `column "x" does not exist`·`ECONNREFUSED 호스트:포트`
   *    같은 내부 정보가 공개 폼의 빨간 알림에 그대로 뜬다. 원인은 route.ts onError가 로그에 남긴다.
   * 의도적으로 만든 TRPCError(레이트리밋·권한·NOT_FOUND 등)의 문구는 그대로 나간다.
   */
  errorFormatter({ shape, error }) {
    if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
      const firstIssue = error.cause.issues[0];
      return {
        ...shape,
        message: firstIssue ? firstIssue.message : "입력값이 올바르지 않습니다.",
      };
    }
    if (error.code === "INTERNAL_SERVER_ERROR") {
      // 공개면·관리자 양쪽이 쓰는 문구다 — 손님용 안내("전화로 연락")를 넣으면
      // 관리자 로그인 실패 화면에 엉뚱한 말이 뜬다(실측 확인)
      return { ...shape, message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
    return shape;
  },
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
