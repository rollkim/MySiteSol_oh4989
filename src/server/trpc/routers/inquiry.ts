import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { BUILDING_TYPES, INQUIRY_KINDS } from "@/lib/codes";
import { createInquiry, InquiryRateLimitError } from "@/server/services/inquiry.service";

import { publicProcedure, router } from "../init";

/**
 * 공개 문의 접수 (SPEC §4 inquiry.create).
 * 개인정보는 이름·연락처가 전부이고, 동의 없이는 스키마가 통과시키지 않는다 —
 * `privacyConsent: literal(true)`는 "체크 안 하면 못 보낸다"의 서버측 절반이다.
 */
export const inquiryRouter = router({
  create: publicProcedure
    .input(
      z.object({
        /** 매물 상세에서 진입하면 해당 매물 id, 일반 문의는 null */
        propertyId: z.number().int().positive().nullable(),
        // 상한에도 한국어 메시지를 준다 — 없으면 zod 기본 영어 문구가 그대로 폼에 뜬다
        name: z.string().trim().min(1, "성함을 입력해 주세요.").max(40, "성함은 40자 이내로 입력해 주세요."),
        phone: z
          .string()
          .trim()
          .regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "연락 가능한 전화번호를 입력해 주세요.")
          .max(20, "전화번호가 너무 깁니다."),
        /** 확정 M5에서 선택 항목 — 유형·관심 지역만으로도 접수된다 */
        message: z.string().trim().max(2000, "문의 내용은 2,000자 이내로 입력해 주세요."),
        /** 확정안 M5 칩 3종 — 매물 찾기/내놓기/기타 */
        inquiryKind: z.enum(INQUIRY_KINDS, { error: "문의 유형을 선택해 주세요." }),
        interestDong: z.string().trim().min(1).max(30).nullable(),
        interestBuildingType: z.enum(BUILDING_TYPES).nullable(),
        privacyConsent: z.literal(true, {
          error: "개인정보 수집·이용 동의가 필요합니다.",
        }),
        /** [선택] 광고성 정보 수신 — 필수 동의와 분리(법정). 미동의도 접수는 된다 */
        marketingConsent: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createInquiry(
          ctx.db,
          {
            propertyId: input.propertyId,
            name: input.name,
            phone: input.phone,
            message: input.message,
            inquiryKind: input.inquiryKind,
            interestDong: input.interestDong,
            interestBuildingType: input.interestBuildingType,
            marketingConsent: input.marketingConsent,
          },
          ctx.clientIp,
        );
      } catch (inquiryError) {
        if (inquiryError instanceof InquiryRateLimitError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: inquiryError.message });
        }
        throw inquiryError;
      }
    }),
});
