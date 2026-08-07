import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DEAL_TYPES } from "@/lib/codes";
import {
  createOwnerRequest,
  OwnerRequestRateLimitError,
} from "@/server/services/owner-request.service";

import { publicProcedure, router } from "../init";

/**
 * 매물 등록 의뢰 접수 (SPEC §4 ownerRequest.create) — 집주인이 "내 매물 내놓기"로 보낸다.
 * 주소는 정확할 필요 없다(addressHint) — 상담 전화에서 확정하는 흐름이다.
 */
export const ownerRequestRouter = router({
  create: publicProcedure
    .input(
      z.object({
        // 상한에도 한국어 메시지를 준다 — 없으면 zod 기본 영어 문구가 그대로 폼에 뜬다
        name: z.string().trim().min(1, "성함을 입력해 주세요.").max(40, "성함은 40자 이내로 입력해 주세요."),
        phone: z
          .string()
          .trim()
          .regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "연락 가능한 전화번호를 입력해 주세요.")
          .max(20, "전화번호가 너무 깁니다."),
        addressHint: z.string().trim().max(200, "위치는 200자 이내로 입력해 주세요.").nullable(),
        dealType: z.enum(DEAL_TYPES).nullable(),
        message: z.string().trim().max(2000, "내용은 2,000자 이내로 입력해 주세요.").nullable(),
        privacyConsent: z.literal(true, {
          error: "개인정보 수집·이용 동의가 필요합니다.",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createOwnerRequest(
          ctx.db,
          {
            name: input.name,
            phone: input.phone,
            addressHint: input.addressHint,
            dealType: input.dealType,
            message: input.message,
          },
          ctx.clientIp,
        );
      } catch (requestError) {
        if (requestError instanceof OwnerRequestRateLimitError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: requestError.message });
        }
        throw requestError;
      }
    }),
});
