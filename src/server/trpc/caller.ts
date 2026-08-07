import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { createTRPCContext } from "./context";
import { createCallerFactory } from "./init";
import { appRouter } from "./routers/_app";

const createCaller = createCallerFactory(appRouter);

/**
 * 서버 컴포넌트용 caller — HTTP 왕복 없이 같은 프로세스에서 프로시저를 부른다.
 * 컨텍스트는 실제 요청 헤더로 만들므로 detailAddress 제거·세션 판독 같은
 * 라우터의 방어가 화면 경로에서도 똑같이 적용된다(RULE-14: 레이어를 건너뛰지 않는다).
 *
 * react cache로 요청당 1회만 생성 — generateMetadata와 페이지가 각각 불러도
 * 컨텍스트(세션 JWT 검증 포함)를 두 번 만들지 않는다.
 */
export const getServerCaller = cache(async () => {
  return createCaller(await createTRPCContext({ headers: await headers() }));
});
