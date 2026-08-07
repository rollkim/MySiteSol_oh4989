import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers/_app";

/**
 * tRPC HTTP 입구 — 모든 클라이언트 요청이 /api/trpc/* 로 들어와 여기서 라우터로 갈린다.
 * App Router는 Web 표준 Request/Response 기반 fetch 어댑터를 쓴다.
 * GET·POST를 같은 핸들러로 노출한다(쿼리는 GET, 뮤테이션은 POST 배치).
 */
function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    /**
     * 예상 밖 서버 오류를 콘솔(PM2 로그)에 원인까지 남긴다.
     * 클라이언트 응답에는 cause가 직렬화되지 않아, 여기 안 찍으면
     * DB 연결 실패 같은 인프라 원인을 서버에서 볼 방법이 없다.
     */
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path ?? "?"} 실패:`, error.cause ?? error);
      }
    },
  });
}

export { handler as GET, handler as POST };
