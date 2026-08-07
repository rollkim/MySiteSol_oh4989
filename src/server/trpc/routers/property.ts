import { after } from "next/server";

import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  between,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { properties, propertyImages, propertyOptions, propertyViewDaily } from "@/db/schema";
import {
  escapeLikePattern,
  MAP_KEYWORD_MAX_LENGTH,
  MAP_MARKER_LIMIT,
  MAP_MARKER_MIN_ZOOM,
  publicCoordinate,
} from "@/domain/map";
import { BUILDING_TYPES, DEAL_TYPES, PROPERTY_LIST_SORTS } from "@/lib/codes";

import { publicProcedure, router } from "../init";

/**
 * 공개 매물 조회. **detailAddress는 select 목록에 아예 없다** (RULE-11) —
 * 응답 가공에서 빼는 방식은 컬럼 추가·리팩토링 때 조용히 새기 쉽다.
 * 노출 대상: listingVisibility=VISIBLE(+미보관·미삭제). 거래완료는 표시 전환으로 포함,
 * 지도·홈·related는 완료를 제외한다. 숨김·보관·삭제는 404.
 * ⚠️ 공개 필터에는 반드시 archivedAt IS NULL을 함께 건다 — 부분 인덱스 술어와
 * 일치해야 인덱스를 타고, 빠뜨리면 보관 매물이 공개면에 새어 나온다.
 */

/** 공개 조건 — 모든 공개 조회의 공통 접두. 여기 하나만 고치면 전부 같이 바뀐다 */
const publiclyVisible = and(
  eq(properties.listingVisibility, "VISIBLE"),
  isNull(properties.deletedAt),
  isNull(properties.archivedAt),
);

/** 공개 응답에 실어도 되는 컬럼만 — 여기 없는 컬럼은 공개면에 존재하지 않는 것과 같다 */
const publicPropertyColumns = {
  id: properties.id,
  title: properties.title,
  buildingType: properties.buildingType,
  dealType: properties.dealType,
  dealProgress: properties.dealProgress,
  priceNegotiable: properties.priceNegotiable,
  brokerFeeNote: properties.brokerFeeNote,
  mapPinMode: properties.mapPinMode,
  salePrice: properties.salePrice,
  deposit: properties.deposit,
  monthlyRent: properties.monthlyRent,
  exclusiveArea: properties.exclusiveArea,
  supplyArea: properties.supplyArea,
  floor: properties.floor,
  totalFloor: properties.totalFloor,
  floorDisplay: properties.floorDisplay,
  roomCount: properties.roomCount,
  bathCount: properties.bathCount,
  direction: properties.direction,
  directionBase: properties.directionBase,
  moveInDate: properties.moveInDate,
  approvalDate: properties.approvalDate,
  parkingTotal: properties.parkingTotal,
  parkingPerUnit: properties.parkingPerUnit,
  buildingUse: properties.buildingUse,
  maintenanceFee: properties.maintenanceFee,
  maintenanceDetail: properties.maintenanceDetail,
  premiumFee: properties.premiumFee,
  businessTypeCurrent: properties.businessTypeCurrent,
  businessTypeRecommended: properties.businessTypeRecommended,
  sido: properties.sido,
  sigungu: properties.sigungu,
  dong: properties.dong,
  lat: properties.lat,
  lng: properties.lng,
  description: properties.description,
  videoUrl: properties.videoUrl,
  videoDuration: properties.videoDuration,
  videoSummary: properties.videoSummary,
  fieldCheckedAt: properties.fieldCheckedAt,
  completedAt: properties.completedAt,
  createdAt: properties.createdAt,
} as const;

/** 한국 위경도 범위 좌표 */
const koreaCoordinate = z.object({
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
});

export const propertyRouter = router({
  /**
   * 지도 bounds 검색 (SPEC §4) — 이 사이트에서 가장 자주 도는 쿼리.
   * 줌이 MAP_MARKER_MIN_ZOOM 미만이면 동 단위 집계(count·대표좌표)만 반환하고,
   * 이상이면 개별 마커를 상한(MAP_MARKER_LIMIT)까지 반환한다.
   * 지도는 **거래완료를 제외**하고 보여준다(계약중은 광고 유지라 포함) —
   * 거래완료는 상세 직링크로만 접근된다.
   */
  mapSearch: publicProcedure
    .input(
      z
        .object({
          bounds: z.object({ sw: koreaCoordinate, ne: koreaCoordinate }),
          zoom: z.number().int().min(1).max(21),
          dealTypes: z.array(z.enum(DEAL_TYPES)).max(DEAL_TYPES.length).optional(),
          buildingTypes: z.array(z.enum(BUILDING_TYPES)).max(BUILDING_TYPES.length).optional(),
          /** 건물명·단지 검색 (확정안 PC2 조건 패널) — 제목 부분 일치 */
          keyword: z.string().trim().min(1).max(MAP_KEYWORD_MAX_LENGTH).optional(),
        })
        .refine(
          (value) =>
            value.bounds.sw.lat < value.bounds.ne.lat &&
            value.bounds.sw.lng < value.bounds.ne.lng,
          { message: "bounds의 남서·북동 좌표가 뒤집혀 있습니다." },
        ),
    )
    .query(async ({ ctx, input }) => {
      const visibleInBounds = and(
        publiclyVisible,
        ne(properties.dealProgress, "COMPLETED"),
        between(properties.lat, input.bounds.sw.lat, input.bounds.ne.lat),
        between(properties.lng, input.bounds.sw.lng, input.bounds.ne.lng),
        input.dealTypes?.length ? inArray(properties.dealType, input.dealTypes) : undefined,
        input.buildingTypes?.length
          ? inArray(properties.buildingType, input.buildingTypes)
          : undefined,
        input.keyword ? ilike(properties.title, `%${escapeLikePattern(input.keyword)}%`) : undefined,
      );

      // 줌아웃 — 동별 집계(마커 대신 숫자 원). avg는 numeric(string)으로 오므로 Number 변환
      if (input.zoom < MAP_MARKER_MIN_ZOOM) {
        const dongRows = await ctx.db
          .select({
            dong: properties.dong,
            propertyCount: sql<number>`count(*)::int`,
            lat: sql<string>`avg(${properties.lat})`,
            lng: sql<string>`avg(${properties.lng})`,
          })
          .from(properties)
          .where(visibleInBounds)
          .groupBy(properties.dong);
        return {
          mode: "dong" as const,
          dongGroups: dongRows.map((row) => ({
            dong: row.dong,
            propertyCount: row.propertyCount,
            lat: Number(row.lat),
            lng: Number(row.lng),
          })),
        };
      }

      // 줌인 — 개별 마커. 상한+1로 조회해 초과 여부를 한 쿼리로 판정한다
      const markerRows = await ctx.db
        .select({
          id: properties.id,
          title: properties.title,
          dealType: properties.dealType,
          buildingType: properties.buildingType,
          salePrice: properties.salePrice,
          deposit: properties.deposit,
          monthlyRent: properties.monthlyRent,
          exclusiveArea: properties.exclusiveArea,
          floor: properties.floor,
          totalFloor: properties.totalFloor,
          floorDisplay: properties.floorDisplay,
          dong: properties.dong,
          videoUrl: properties.videoUrl, // 영상 보유 마커 ▶ 도트 (디자인가이드 §5-5)
          lat: properties.lat,
          lng: properties.lng,
          mapPinMode: properties.mapPinMode, // DONG_CENTER면 응답 좌표를 치환한다(실좌표 비노출)
        })
        .from(properties)
        .where(visibleInBounds)
        .orderBy(desc(properties.createdAt))
        .limit(MAP_MARKER_LIMIT + 1);

      const truncated = markerRows.length > MAP_MARKER_LIMIT;
      const pageRows = truncated ? markerRows.slice(0, MAP_MARKER_LIMIT) : markerRows;

      // 초과 시 실제 총 건수 — "매물 N건" 표기가 상한값으로 왜곡되지 않게(SPEC §4)
      let totalCount = pageRows.length;
      if (truncated) {
        const [countRow] = await ctx.db
          .select({ totalCount: sql<number>`count(*)::int` })
          .from(properties)
          .where(visibleInBounds);
        totalCount = countRow.totalCount;
      }

      // 좌측 리스트 카드용 대표 썸네일(sortOrder=0) — 마커와 같은 응답을 공유한다
      const thumbRows = pageRows.length
        ? await ctx.db
            .select({
              propertyId: propertyImages.propertyId,
              thumbPath: propertyImages.thumbPath,
            })
            .from(propertyImages)
            .where(
              and(
                inArray(
                  propertyImages.propertyId,
                  pageRows.map((row) => row.id),
                ),
                eq(propertyImages.sortOrder, 0),
              ),
            )
        : [];
      const thumbByPropertyId = new Map(thumbRows.map((row) => [row.propertyId, row.thumbPath]));

      return {
        mode: "markers" as const,
        markers: pageRows.map(({ videoUrl, mapPinMode, lat, lng, ...marker }) => ({
          ...marker,
          ...publicCoordinate(marker.dong, lat, lng, mapPinMode),
          hasVideo: videoUrl !== null,
          thumbPath: thumbByPropertyId.get(marker.id) ?? null,
        })),
        truncated, // true면 화면이 "더 확대해 주세요" 안내를 띄운다
        totalCount, // 상한 초과 시에도 실제 총 건수로 "매물 N건"을 표기한다(SPEC §4)
      };
    }),

  /**
   * 홈(확정안 M1/PC1) 요약 — 최신·상가·영상 매물 목록과 유형별 건수를 한 응답으로.
   * 홈 서버 컴포넌트가 요청마다 부르므로 쿼리 수를 고정한다(목록 3 + 집계 1 + 썸네일 1).
   */
  homeSummary: publicProcedure.query(async ({ ctx }) => {
    // 홈은 거래완료를 세지도 보여주지도 않는다 — "오늘 새로 나온 자리"의 의미
    const visible = and(publiclyVisible, ne(properties.dealProgress, "COMPLETED"));
    const cardColumns = {
      id: properties.id,
      title: properties.title,
      dealType: properties.dealType,
      buildingType: properties.buildingType,
      salePrice: properties.salePrice,
      deposit: properties.deposit,
      monthlyRent: properties.monthlyRent,
      exclusiveArea: properties.exclusiveArea,
      floor: properties.floor,
      totalFloor: properties.totalFloor,
      floorDisplay: properties.floorDisplay,
      dong: properties.dong,
      videoUrl: properties.videoUrl,
    } as const;

    const [latestRows, storeRows, videoRows, [buildingCounts]] = await Promise.all([
      ctx.db
        .select(cardColumns)
        .from(properties)
        .where(visible)
        .orderBy(desc(properties.createdAt))
        .limit(8),
      ctx.db
        .select(cardColumns)
        .from(properties)
        .where(and(visible, eq(properties.buildingType, "STORE")))
        .orderBy(desc(properties.createdAt))
        .limit(4),
      ctx.db
        .select(cardColumns)
        .from(properties)
        .where(and(visible, isNotNull(properties.videoUrl)))
        .orderBy(desc(properties.createdAt))
        .limit(4),
      ctx.db
        .select({
          totalCount: sql<number>`count(*)::int`,
          storeCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'STORE')::int`,
          aptCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'APT')::int`,
          officetelCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'OFFICETEL')::int`,
          firstFloorStoreCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'STORE' and ${properties.floor} = 1)::int`,
          upperFloorStoreCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'STORE' and ${properties.floor} >= 2)::int`,
          // 권리금 null=미기재는 '무권리'로 세지 않는다(0='없음'만) — 미기재를 무권리로 광고하면 부당표시(RULE-11)
          noPremiumStoreCount: sql<number>`count(*) filter (where ${properties.buildingType} = 'STORE' and ${properties.premiumFee} = 0)::int`,
          videoCount: sql<number>`count(*) filter (where ${properties.videoUrl} is not null)::int`,
        })
        .from(properties)
        .where(visible),
    ]);

    // 세 목록이 겹칠 수 있으므로 id 합집합으로 대표 썸네일(sortOrder=0)을 한 쿼리로 붙인다
    const cardIds = [...new Set([...latestRows, ...storeRows, ...videoRows].map((row) => row.id))];
    const thumbRows = cardIds.length
      ? await ctx.db
          .select({ propertyId: propertyImages.propertyId, thumbPath: propertyImages.thumbPath })
          .from(propertyImages)
          .where(and(inArray(propertyImages.propertyId, cardIds), eq(propertyImages.sortOrder, 0)))
      : [];
    const thumbByPropertyId = new Map(thumbRows.map((row) => [row.propertyId, row.thumbPath]));
    const toHomeCard = ({ videoUrl, ...row }: (typeof latestRows)[number]) => ({
      ...row,
      hasVideo: videoUrl !== null,
      thumbPath: thumbByPropertyId.get(row.id) ?? null,
    });

    return {
      latestItems: latestRows.map(toHomeCard),
      storeItems: storeRows.map(toHomeCard),
      videoItems: videoRows.map(toHomeCard),
      buildingCounts,
    };
  }),

  /**
   * 목록형 매물 (확정안 M2) — 커서 무한스크롤 + 정렬 3종 + 키워드 + 총 건수.
   * 목록에는 거래완료도 포함한다 — "거래완료 즉시 표시"(§8)는 숨김이 아니라 표시 전환이다.
   * 가격 정렬 키 = coalesce(매매가, 보증금): 거래유형 혼합 시 단일 축이 없어 대표값을 쓴다
   * (유형·거래 칩과 함께 쓰는 전제). 가격 미정(협의)은 센티널로 맨 뒤.
   * 커서 = (정렬값, id) 복합 — 정렬값이 같은 행에서도 페이지가 겹치거나 빠지지 않는다.
   */
  list: publicProcedure
    .input(
      z.object({
        dealTypes: z.array(z.enum(DEAL_TYPES)).max(DEAL_TYPES.length).optional(),
        buildingTypes: z.array(z.enum(BUILDING_TYPES)).max(BUILDING_TYPES.length).optional(),
        keyword: z.string().trim().min(1).max(MAP_KEYWORD_MAX_LENGTH).optional(),
        sort: z.enum(PROPERTY_LIST_SORTS).default("LATEST"),
        /** 직전 페이지 마지막 행의 (id, 정렬값) — 없으면 첫 페이지. 클라이언트 런타임이
         *  첫 페이지에 cursor: null을 실어 보내므로 nullish여야 한다 */
        cursor: z
          .object({
            lastId: z.number().int().positive(),
            lastSortValue: z.number().nullable(),
          })
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const PAGE_SIZE = 20;
      /** 가격 미정(협의) 정렬용 센티널 — int4 안에서 실가격보다 항상 큼(= 맨 뒤) */
      const PRICE_SENTINEL = 2_000_000_000;
      const priceSortValue = sql`coalesce(${properties.salePrice}, ${properties.deposit}, ${PRICE_SENTINEL})`;

      const baseFilter = and(
        // 목록은 거래완료도 포함(§8 표시 전환) — 노출·미보관·미삭제만 거른다
        publiclyVisible,
        input.dealTypes?.length ? inArray(properties.dealType, input.dealTypes) : undefined,
        input.buildingTypes?.length
          ? inArray(properties.buildingType, input.buildingTypes)
          : undefined,
        input.keyword ? ilike(properties.title, `%${escapeLikePattern(input.keyword)}%`) : undefined,
      );

      // 복합 커서 — 정렬 방향과 같은 방향의 행 튜플 비교.
      // LATEST는 진열 순서(displayOrder asc) 우선 + 최신순(id desc) — 방향이 섞여
      // 튜플 비교가 안 되므로 명시적 OR로 쓴다(사용자 확정 2026-08-07: 진열순서 우선).
      let cursorFilter = undefined;
      if (input.cursor) {
        const { lastId, lastSortValue } = input.cursor;
        if (input.sort === "PRICE_ASC" && lastSortValue !== null) {
          cursorFilter = sql`(${priceSortValue}, ${properties.id}) > (${lastSortValue}, ${lastId})`;
        } else if (input.sort === "AREA_DESC" && lastSortValue !== null) {
          cursorFilter = sql`(${properties.exclusiveArea}, ${properties.id}) < (${lastSortValue}, ${lastId})`;
        } else if (lastSortValue !== null) {
          cursorFilter = or(
            sql`${properties.displayOrder} > ${lastSortValue}`,
            and(
              sql`${properties.displayOrder} = ${lastSortValue}`,
              sql`${properties.id} < ${lastId}`,
            ),
          );
        } else {
          cursorFilter = sql`${properties.id} < ${lastId}`;
        }
      }

      const orderBy =
        input.sort === "PRICE_ASC"
          ? [sql`${priceSortValue} asc`, asc(properties.id)]
          : input.sort === "AREA_DESC"
            ? [desc(properties.exclusiveArea), desc(properties.id)]
            : [asc(properties.displayOrder), desc(properties.id)];

      const [rows, [countRow]] = await Promise.all([
        ctx.db
          .select({
            id: properties.id,
            title: properties.title,
            dealType: properties.dealType,
            buildingType: properties.buildingType,
            dealProgress: properties.dealProgress,
            displayOrder: properties.displayOrder,
            salePrice: properties.salePrice,
            deposit: properties.deposit,
            monthlyRent: properties.monthlyRent,
            exclusiveArea: properties.exclusiveArea,
            floor: properties.floor,
            totalFloor: properties.totalFloor,
            floorDisplay: properties.floorDisplay,
            dong: properties.dong,
            createdAt: properties.createdAt,
          })
          .from(properties)
          .where(and(baseFilter, cursorFilter))
          .orderBy(...orderBy)
          .limit(PAGE_SIZE + 1),
        // 총 건수 — "매물 N건" 표기(확정안 M2). 단일 사무소 규모라 페이지마다 세도 밀리초 미만
        ctx.db
          .select({ totalCount: sql<number>`count(*)::int` })
          .from(properties)
          .where(baseFilter),
      ]);

      const pageRows = rows.length > PAGE_SIZE ? rows.slice(0, PAGE_SIZE) : rows;

      // 대표 썸네일(sortOrder=0)을 한 쿼리로 붙인다
      const thumbRows = pageRows.length
        ? await ctx.db
            .select({ propertyId: propertyImages.propertyId, thumbPath: propertyImages.thumbPath })
            .from(propertyImages)
            .where(
              and(
                inArray(
                  propertyImages.propertyId,
                  pageRows.map((row) => row.id),
                ),
                eq(propertyImages.sortOrder, 0),
              ),
            )
        : [];
      const thumbByPropertyId = new Map(thumbRows.map((row) => [row.propertyId, row.thumbPath]));

      const lastRow = pageRows[pageRows.length - 1];
      const nextCursor =
        rows.length > PAGE_SIZE && lastRow
          ? {
              lastId: lastRow.id,
              lastSortValue:
                input.sort === "PRICE_ASC"
                  ? (lastRow.salePrice ?? lastRow.deposit ?? PRICE_SENTINEL)
                  : input.sort === "AREA_DESC"
                    ? Number(lastRow.exclusiveArea)
                    : lastRow.displayOrder,
            }
          : null;

      return {
        items: pageRows.map((row) => ({
          ...row,
          thumbPath: thumbByPropertyId.get(row.id) ?? null,
        })),
        nextCursor,
        totalCount: countRow.totalCount,
      };
    }),

  detail: publicProcedure
    .input(z.object({ propertyId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select(publicPropertyColumns)
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), publiclyVisible));
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

      // 조회수 — 응답 경로 밖(after)에서 올린다: 방문자 응답이 UPDATE를 기다리지 않는다.
      // updatedAt은 명시적으로 기존 값을 유지한다 — $onUpdate가 조회마다
      // "매물 수정 시각"을 오염시키면 안 된다(리뷰 확정 major).
      after(async () => {
        try {
          await ctx.db
            .update(properties)
            .set({
              viewCount: sql`${properties.viewCount} + 1`,
              updatedAt: sql`${properties.updatedAt}`,
            })
            .where(eq(properties.id, input.propertyId));
          // 일자별 집계(A1 '이번 주 조회') — 누적 viewCount로는 기간 분해가 불가능하다
          await ctx.db
            .insert(propertyViewDaily)
            .values({
              propertyId: input.propertyId,
              viewDate: sql`current_date`,
              viewCount: 1,
            })
            .onConflictDoUpdate({
              target: [propertyViewDaily.propertyId, propertyViewDaily.viewDate],
              set: { viewCount: sql`${propertyViewDaily.viewCount} + 1` },
            });
        } catch (viewCountError) {
          console.error("viewCount 증가 실패:", viewCountError);
        }
      });

      // DONG_CENTER면 상세 미니맵 좌표도 동 중심으로 — 실좌표는 응답에 싣지 않는다
      const coordinate = publicCoordinate(
        property.dong,
        property.lat,
        property.lng,
        property.mapPinMode,
      );
      return {
        property: { ...property, ...coordinate },
        images,
        optionCodes: options.map((option) => option.optionCode),
      };
    }),

  /** 같은 동의 다른 거래중 매물 3건 (§4-P3 마지막 블록) */
  related: publicProcedure
    .input(z.object({ propertyId: z.number().int().positive(), dong: z.string().max(30) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: properties.id,
          title: properties.title,
          dealType: properties.dealType,
          salePrice: properties.salePrice,
          deposit: properties.deposit,
          monthlyRent: properties.monthlyRent,
          dong: properties.dong,
        })
        .from(properties)
        .where(
          and(
            eq(properties.dong, input.dong),
            ne(properties.id, input.propertyId),
            publiclyVisible,
            ne(properties.dealProgress, "COMPLETED"),
          ),
        )
        .orderBy(desc(properties.createdAt))
        .limit(3);

      // 대표 썸네일(sortOrder=0)을 붙인다 — N+1이지만 N≤3
      return Promise.all(
        rows.map(async (row) => {
          const [thumb] = await ctx.db
            .select({ thumbPath: propertyImages.thumbPath })
            .from(propertyImages)
            .where(eq(propertyImages.propertyId, row.id))
            .orderBy(asc(propertyImages.sortOrder))
            .limit(1);
          return { ...row, thumbPath: thumb?.thumbPath ?? null };
        }),
      );
    }),
});
