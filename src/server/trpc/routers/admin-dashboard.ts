import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { inquiries, properties, propertyImages, propertyViewDaily } from "@/db/schema";

import { adminProcedure, router } from "../init";

/**
 * A1 대시보드 집계 — 확정 기획: KPI 4장(새 문의·노출 만료 임박·공개 중·이번 주 조회) +
 * 오늘 할 일(신규 문의 2·만료 임박·사진 없는 매물) + 많이 본 매물(7일) + 최근 등록 6.
 * 단일 사무소 규모(수십 건)라 요청당 집계로 충분 — 캐시·머티리얼라이즈 없음.
 */

/** 노출 만료 임박 기준 — 기획: "등록 90일 지난 매물, 확인 필요" */
const EXPOSURE_LIMIT_DAYS = 90;

export const adminDashboardRouter = router({
  summary: adminProcedure.query(async ({ ctx }) => {
    const exposureDeadline = new Date(Date.now() - EXPOSURE_LIMIT_DAYS * 24 * 60 * 60 * 1000);

    // 보관함·삭제 제외가 모든 집계의 공통 전제 — 노출/거래 진행은 filter 절에서 나눈다
    const liveProperty = and(isNull(properties.deletedAt), isNull(properties.archivedAt));

    const [
      [propertyCounts],
      [inquiryCounts],
      recentInquiries,
      [viewCounts],
      popularRows,
      recentRows,
    ] = await Promise.all([
      // 공개 중 매물 + 유형 소계 + 만료 임박 + 사진 없는 매물 — 한 스캔으로
      ctx.db
        .select({
          visibleCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and ${properties.dealProgress} != 'COMPLETED')::int`,
          storeCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and ${properties.dealProgress} != 'COMPLETED' and ${properties.buildingType} = 'STORE')::int`,
          aptCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and ${properties.dealProgress} != 'COMPLETED' and ${properties.buildingType} = 'APT')::int`,
          officetelCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and ${properties.dealProgress} != 'COMPLETED' and ${properties.buildingType} = 'OFFICETEL')::int`,
          // 거래완료는 만료 임박에서 뺀다 — 다른 카운트와 기준을 맞춘다
          expiringSoonCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and ${properties.dealProgress} != 'COMPLETED' and ${properties.exposureCheckedAt} < ${exposureDeadline})::int`,
          noPhotoCount: sql<number>`count(*) filter (where ${properties.listingVisibility} = 'VISIBLE' and not exists (select 1 from ${propertyImages} where ${propertyImages.propertyId} = ${properties.id}))::int`,
        })
        .from(properties)
        .where(liveProperty),
      ctx.db
        .select({
          newCount: sql<number>`count(*) filter (where ${inquiries.status} = 'NEW')::int`,
          oldestNewAt: sql<string | null>`min(${inquiries.createdAt}) filter (where ${inquiries.status} = 'NEW')`,
        })
        .from(inquiries),
      // 오늘 할 일 — 신규 문의 상위 2건 (기획 todos의 문의 행)
      ctx.db
        .select({
          id: inquiries.id,
          name: inquiries.name,
          message: inquiries.message,
          phone: inquiries.phone,
          propertyId: inquiries.propertyId,
          createdAt: inquiries.createdAt,
        })
        .from(inquiries)
        .where(eq(inquiries.status, "NEW"))
        .orderBy(desc(inquiries.createdAt))
        .limit(2),
      // 이번 주(7일) 조회 합 + 직전 7일 합 (증감 표기)
      // 경계는 DB의 current_date로 계산한다 — 조회수 기록도 current_date로 찍히므로
      // JS의 UTC 날짜를 쓰면 KST 오전에 하루가 어긋나 구간 길이가 달라진다(리뷰 확정)
      ctx.db
        .select({
          weeklyViewCount: sql<number>`coalesce(sum(${propertyViewDaily.viewCount}) filter (where ${propertyViewDaily.viewDate} > current_date - 7), 0)::int`,
          previousWeekViewCount: sql<number>`coalesce(sum(${propertyViewDaily.viewCount}) filter (where ${propertyViewDaily.viewDate} > current_date - 14 and ${propertyViewDaily.viewDate} <= current_date - 7), 0)::int`,
        })
        .from(propertyViewDaily),
      // 이번 주 많이 본 매물 5 — view_daily 7일 합 상위
      ctx.db
        .select({
          propertyId: propertyViewDaily.propertyId,
          title: properties.title,
          weekViews: sql<number>`sum(${propertyViewDaily.viewCount})::int`,
        })
        .from(propertyViewDaily)
        .innerJoin(properties, eq(properties.id, propertyViewDaily.propertyId))
        .where(
          and(sql`${propertyViewDaily.viewDate} > current_date - 7`, isNull(properties.deletedAt)),
        )
        .groupBy(propertyViewDaily.propertyId, properties.title)
        .orderBy(desc(sql`sum(${propertyViewDaily.viewCount})`))
        .limit(5),
      // 최근 등록 6
      ctx.db
        .select({
          id: properties.id,
          title: properties.title,
          dealType: properties.dealType,
          salePrice: properties.salePrice,
          deposit: properties.deposit,
          monthlyRent: properties.monthlyRent,
          listingVisibility: properties.listingVisibility,
          dealProgress: properties.dealProgress,
          createdAt: properties.createdAt,
        })
        .from(properties)
        .where(liveProperty)
        .orderBy(desc(properties.createdAt))
        .limit(6),
    ]);

    // 최근 등록 대표 썸네일(sortOrder=0)
    const recentIds = recentRows.map((row) => row.id);
    const thumbRows = recentIds.length
      ? await ctx.db
          .select({ propertyId: propertyImages.propertyId, thumbPath: propertyImages.thumbPath })
          .from(propertyImages)
          .where(and(inArray(propertyImages.propertyId, recentIds), eq(propertyImages.sortOrder, 0)))
      : [];
    const thumbByPropertyId = new Map(thumbRows.map((row) => [row.propertyId, row.thumbPath]));

    return {
      kpi: {
        newInquiryCount: inquiryCounts.newCount,
        oldestNewInquiryAt: inquiryCounts.oldestNewAt,
        expiringSoonCount: propertyCounts.expiringSoonCount,
        visibleCount: propertyCounts.visibleCount,
        storeCount: propertyCounts.storeCount,
        aptCount: propertyCounts.aptCount,
        officetelCount: propertyCounts.officetelCount,
        weeklyViewCount: viewCounts.weeklyViewCount,
        previousWeekViewCount: viewCounts.previousWeekViewCount,
      },
      todoInquiries: recentInquiries,
      noPhotoCount: propertyCounts.noPhotoCount,
      popular: popularRows,
      recent: recentRows.map((row) => ({
        ...row,
        thumbPath: thumbByPropertyId.get(row.id) ?? null,
      })),
    };
  }),
});

