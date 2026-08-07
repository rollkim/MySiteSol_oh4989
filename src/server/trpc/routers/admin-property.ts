import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { properties, propertyImages, propertyOptions } from "@/db/schema";
import { escapeLikePattern, MAP_KEYWORD_MAX_LENGTH } from "@/domain/map";
import { propertySaveSchema } from "@/domain/property-schema";
import {
  BUILDING_TYPES,
  DEAL_TYPES,
  PROPERTY_DEAL_PROGRESS,
  PROPERTY_VISIBILITY,
} from "@/lib/codes";
import {
  createProperty,
  PropertyNotFoundError,
  PublicationRequirementError,
  renewPropertyExposure,
  setPropertyArchived,
  softDeleteProperty,
  StalePropertyUpdateError,
  updateProperty,
  updatePropertyExposure,
} from "@/server/services/property.service";

import { adminProcedure, router } from "../init";

const propertyIdInput = z.object({ propertyId: z.number().int().positive() });

function toTRPCError(error: unknown): never {
  if (error instanceof PropertyNotFoundError) {
    throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  }
  if (error instanceof PublicationRequirementError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  if (error instanceof StalePropertyUpdateError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  throw error;
}

/** admin.property — 유일하게 detailAddress를 응답에 실을 수 있는 라우터(RULE-11) */
export const adminPropertyRouter = router({
  /**
   * A2 매물 관리 목록 — 검색(매물명·주소·관리번호) + 필터 + 정렬.
   * 기획 확정: **거래완료는 자동으로 맨 뒤**, 보관함은 기본 제외(탭으로 전환).
   */
  list: adminProcedure
    .input(
      z
        .object({
          keyword: z.string().trim().min(1).max(MAP_KEYWORD_MAX_LENGTH).optional(),
          buildingTypes: z.array(z.enum(BUILDING_TYPES)).max(BUILDING_TYPES.length).optional(),
          dealTypes: z.array(z.enum(DEAL_TYPES)).max(DEAL_TYPES.length).optional(),
          listingVisibility: z.enum(PROPERTY_VISIBILITY).optional(),
          dealProgress: z.enum(PROPERTY_DEAL_PROGRESS).optional(),
          /** 보관함 탭 — true면 보관된 것만, 기본(false)은 보관 제외 */
          archivedOnly: z.boolean().default(false),
        })
        .default({ archivedOnly: false }),
    )
    .query(async ({ ctx, input }) => {
      const listFilter = and(
        isNull(properties.deletedAt),
        input.archivedOnly ? isNotNull(properties.archivedAt) : isNull(properties.archivedAt),
        input.keyword
          ? or(
              ilike(properties.title, `%${escapeLikePattern(input.keyword)}%`),
              ilike(properties.jibunAddress, `%${escapeLikePattern(input.keyword)}%`),
              ilike(properties.roadAddress, `%${escapeLikePattern(input.keyword)}%`),
              ilike(properties.listingCode, `%${escapeLikePattern(input.keyword)}%`),
            )
          : undefined,
        input.buildingTypes?.length
          ? inArray(properties.buildingType, input.buildingTypes)
          : undefined,
        input.dealTypes?.length ? inArray(properties.dealType, input.dealTypes) : undefined,
        input.listingVisibility
          ? eq(properties.listingVisibility, input.listingVisibility)
          : undefined,
        input.dealProgress ? eq(properties.dealProgress, input.dealProgress) : undefined,
      );

      const [rows, [counts]] = await Promise.all([
        ctx.db
          .select({
            id: properties.id,
            title: properties.title,
            listingCode: properties.listingCode,
            jibunAddress: properties.jibunAddress,
            roadAddress: properties.roadAddress,
            buildingType: properties.buildingType,
            dealType: properties.dealType,
            listingVisibility: properties.listingVisibility,
            dealProgress: properties.dealProgress,
            displayOrder: properties.displayOrder,
            brokerFeeNote: properties.brokerFeeNote,
            salePrice: properties.salePrice,
            deposit: properties.deposit,
            monthlyRent: properties.monthlyRent,
            priceNegotiable: properties.priceNegotiable,
            exclusiveArea: properties.exclusiveArea,
            viewCount: properties.viewCount,
            archivedAt: properties.archivedAt,
            exposureCheckedAt: properties.exposureCheckedAt,
            // 만료 임박 판정은 서버(DB 시계)에서 한다 — 클라이언트 시계에 의존하지 않고
            // A1 KPI와 같은 기준(등록 90일)을 한 곳에서 정한다
            isExposureExpiring: sql<boolean>`${properties.exposureCheckedAt} < now() - interval '90 days'`,
            dong: properties.dong,
            createdAt: properties.createdAt,
            thumbPath: sql<
              string | null
            >`(select ${propertyImages.thumbPath} from ${propertyImages} where ${propertyImages.propertyId} = ${properties.id} order by ${propertyImages.sortOrder} limit 1)`,
          })
          .from(properties)
          .where(listFilter)
          // 거래완료 자동 후순위(기획) → 진열 순서 → 최신 등록순
          .orderBy(
            sql`case when ${properties.dealProgress} = 'COMPLETED' then 1 else 0 end`,
            asc(properties.displayOrder),
            desc(properties.createdAt),
          )
          .limit(200), // 단일 사무소 규모 — 페이징은 필요해질 때
        // 상단바 요약 "전체 N건 · 공개 N · 비공개 N" — 필터와 무관한 전체 기준
        ctx.db
          .select({
            totalCount: sql<number>`count(*) filter (where ${properties.archivedAt} is null)::int`,
            visibleCount: sql<number>`count(*) filter (where ${properties.archivedAt} is null and ${properties.listingVisibility} = 'VISIBLE')::int`,
            hiddenCount: sql<number>`count(*) filter (where ${properties.archivedAt} is null and ${properties.listingVisibility} = 'HIDDEN')::int`,
            archivedCount: sql<number>`count(*) filter (where ${properties.archivedAt} is not null)::int`,
          })
          .from(properties)
          .where(isNull(properties.deletedAt)),
      ]);

      return { items: rows, counts };
    }),

  /** 수정 폼 프리필 — 이미지·옵션 포함 전체 */
  detail: adminProcedure.input(propertyIdInput).query(async ({ ctx, input }) => {
    const [property] = await ctx.db
      .select()
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)));
    if (!property) {
      throw new TRPCError({ code: "NOT_FOUND", message: "매물을 찾을 수 없습니다." });
    }
    const [images, options] = await Promise.all([
      ctx.db
        .select({
          id: propertyImages.id,
          filePath: propertyImages.filePath,
          thumbPath: propertyImages.thumbPath,
          sortOrder: propertyImages.sortOrder,
        })
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, input.propertyId))
        .orderBy(asc(propertyImages.sortOrder)),
      ctx.db
        .select({ optionCode: propertyOptions.optionCode })
        .from(propertyOptions)
        .where(eq(propertyOptions.propertyId, input.propertyId)),
    ]);
    return { property, images, optionCodes: options.map((option) => option.optionCode) };
  }),

  create: adminProcedure
    .input(propertySaveSchema)
    .mutation(({ ctx, input }) => createProperty(ctx.db, ctx.adminUserId, input)),

  update: adminProcedure
    .input(z.object({ propertyId: z.number().int().positive(), data: propertySaveSchema }))
    .mutation(async ({ ctx, input }) => {
      await updateProperty(ctx.db, ctx.adminUserId, input.propertyId, input.data).catch(
        toTRPCError,
      );
      return { ok: true as const };
    }),

  /** 노출·거래 진행 전환 — 두 축 중 지정한 것만 바꾼다(A2 액션·A3 카드2) */
  updateExposure: adminProcedure
    .input(
      propertyIdInput
        .extend({
          listingVisibility: z.enum(PROPERTY_VISIBILITY).optional(),
          dealProgress: z.enum(PROPERTY_DEAL_PROGRESS).optional(),
        })
        .refine(
          (value) => value.listingVisibility !== undefined || value.dealProgress !== undefined,
          { message: "바꿀 축을 하나 이상 지정해 주세요." },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      await updatePropertyExposure(ctx.db, ctx.adminUserId, input.propertyId, {
        listingVisibility: input.listingVisibility,
        dealProgress: input.dealProgress,
      }).catch(toTRPCError);
      return { ok: true as const };
    }),

  /**
   * A2 일괄 처리 — 공개 / 숨김 / 거래완료로 / 보관함.
   * 삭제는 넣지 않는다(설계원칙 2). 각 건은 개별 트랜잭션이라 한 건이 법정 요건으로
   * 막혀도 나머지는 처리되고, 실패 건은 사유와 함께 돌려준다.
   */
  bulkAction: adminProcedure
    .input(
      z.object({
        propertyIds: z.array(z.number().int().positive()).min(1).max(100),
        action: z.enum(["PUBLISH", "HIDE", "COMPLETE", "ARCHIVE", "UNARCHIVE"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const failures: { propertyId: number; message: string }[] = [];
      let successCount = 0;

      for (const propertyId of input.propertyIds) {
        try {
          if (input.action === "ARCHIVE" || input.action === "UNARCHIVE") {
            await setPropertyArchived(
              ctx.db,
              ctx.adminUserId,
              propertyId,
              input.action === "ARCHIVE",
            );
          } else {
            await updatePropertyExposure(ctx.db, ctx.adminUserId, propertyId, {
              listingVisibility:
                input.action === "PUBLISH" ? "VISIBLE" : input.action === "HIDE" ? "HIDDEN" : undefined,
              dealProgress: input.action === "COMPLETE" ? "COMPLETED" : undefined,
            });
          }
          successCount += 1;
        } catch (actionError) {
          if (
            actionError instanceof PublicationRequirementError ||
            actionError instanceof PropertyNotFoundError
          ) {
            failures.push({ propertyId, message: actionError.message });
          } else {
            throw actionError;
          }
        }
      }
      return { successCount, failures };
    }),

  /** 노출 만료 연장 (A1 '확인' 액션·A2) */
  renewExposure: adminProcedure.input(propertyIdInput).mutation(async ({ ctx, input }) => {
    await renewPropertyExposure(ctx.db, input.propertyId);
    return { ok: true as const };
  }),

  softDelete: adminProcedure.input(propertyIdInput).mutation(async ({ ctx, input }) => {
    await softDeleteProperty(ctx.db, ctx.adminUserId, input.propertyId).catch(toTRPCError);
    return { ok: true as const };
  }),
});
