import { adminProcedure, publicProcedure, router } from "../init";

/**
 * 배포 확인용 최소 프로시저.
 *
 * `deploy.sh`가 슬롯 전환 직후 이 응답으로 앱이 실제로 살아났는지 판단한다.
 * 정적 파일(robots.txt)만 확인하면 Next는 떴는데 **서버 코드가 죽은** 상태를 놓친다 —
 * tRPC 왕복이 되는지까지 봐야 "배포 성공"이라 말할 수 있다.
 */
export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    // superjson이 Date를 문자열로 뭉개지 않고 넘기는지도 이 값으로 확인된다
    at: new Date(),
  })),

  /**
   * 관리자 경계가 **닫혀 있는지** 확인하는 프로시저.
   *
   * 인증은 실패했을 때 조용하기 때문에 위험하다 — 미들웨어가 통째로 빠져도 화면은 멀쩡하다.
   * 세션 없이 호출하면 반드시 FORBIDDEN이어야 한다. 이게 200을 주면 관리자 API가 열린 것이다.
   * Phase 1에서 관리자 로그인이 붙은 뒤에는 "유효 세션이면 200"까지 함께 확인한다.
   */
  adminPing: adminProcedure.query(({ ctx }) => ({
    ok: true as const,
    adminUserId: ctx.adminUserId,
  })),
});
