import { router } from "../init";

import { adminAuthRouter } from "./admin-auth";
import { adminDashboardRouter } from "./admin-dashboard";
import { adminInquiryRouter } from "./admin-inquiry";
import { adminOwnerRequestRouter } from "./admin-owner-request";
import { adminPropertyRouter } from "./admin-property";
import { healthRouter } from "./health";
import { inquiryRouter } from "./inquiry";
import { ownerRequestRouter } from "./owner-request";
import { propertyRouter } from "./property";
import { siteSettingRouter } from "./site-setting";

/**
 * 앱 전체 라우터. SPEC §4의 구조로 자라난다:
 *
 *   property     (public)  mapSearch / list / detail / related
 *   inquiry      (public)  create — IP당 시간당 5회 제한
 *   ownerRequest (public)  create
 *   admin        (admin)   auth / property / inquiry / settings
 */
export const appRouter = router({
  health: healthRouter,
  property: propertyRouter,
  inquiry: inquiryRouter,
  ownerRequest: ownerRequestRouter,
  siteSetting: siteSettingRouter,
  admin: router({
    auth: adminAuthRouter,
    dashboard: adminDashboardRouter,
    property: adminPropertyRouter,
    inquiry: adminInquiryRouter,
    ownerRequest: adminOwnerRequestRouter,
  }),
});

export type AppRouter = typeof appRouter;
