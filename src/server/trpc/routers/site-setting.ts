import { getOfficeInfo } from "@/server/services/site-settings.service";

import { publicProcedure, router } from "../init";

/**
 * 사이트 설정 공개 조회 — Phase 1은 사무소 법정정보뿐이다.
 * 페이지(서버 컴포넌트)가 db를 직접 만지지 않고 caller로 이걸 부른다(RULE-14).
 * 관리자용 settings.update는 SPEC §4대로 나중에 admin 네임스페이스에 붙는다.
 */
export const siteSettingRouter = router({
  officeInfo: publicProcedure.query(({ ctx }) => getOfficeInfo(ctx.db)),
});
