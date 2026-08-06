import { router } from "../init";

import { healthRouter } from "./health";

/**
 * 앱 전체 라우터. SPEC §4의 구조로 자라난다:
 *
 *   property     (public)  mapSearch / list / detail / related
 *   inquiry      (public)  create — IP당 시간당 5회 제한
 *   ownerRequest (public)  create
 *   admin        (admin)   auth / property / image / inquiry / settings
 */
export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
