import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import { properties, propertyImages, propertyLogs, propertyOptions } from "@/db/schema";
import type { PropertySaveInput } from "@/domain/property-schema";
import { checkPublicationRequirements } from "@/domain/publication-requirements";
import type { PropertyDealProgress, PropertyVisibility } from "@/lib/codes";

import { deleteStoredImage } from "./image-storage.service";

/**
 * 매물 CRUD — 상태 변경·삭제까지 전부 property_logs를 남긴다(RULE-11).
 * 로그는 거래완료 방치 과태료의 소명자료다: "언제 누가 무엇을" 세 가지가 항상 남아야 한다.
 * 트랜잭션은 이 서비스가 소유한다 — 라우터·화면은 트랜잭션을 모른다(RULE-14).
 */

export class PropertyNotFoundError extends Error {
  constructor(readonly propertyId: number) {
    super("매물을 찾을 수 없습니다.");
    this.name = "PropertyNotFoundError";
  }
}

/** 법정 요건 미비 매물의 공개 전환 거부 — 누락 필드 라벨을 담아 화면이 안내한다 */
export class PublicationRequirementError extends Error {
  constructor(readonly missingMessages: string[]) {
    super(`법정 필수항목이 비어 있어 공개할 수 없습니다: ${missingMessages.join(" / ")}`);
    this.name = "PublicationRequirementError";
  }
}

/** 다른 세션이 먼저 수정한 매물에 대한 낡은 저장 거부 (이미지 lost-update 방지) */
export class StalePropertyUpdateError extends Error {
  constructor() {
    super("다른 곳에서 먼저 수정된 매물입니다. 새로고침 후 다시 저장해 주세요.");
    this.name = "StalePropertyUpdateError";
  }
}

/** 스키마 입력 → properties 컬럼. numeric 컬럼은 drizzle 규약상 string으로 넘긴다 */
function toPropertyColumns(input: PropertySaveInput) {
  return {
    title: input.title,
    buildingType: input.buildingType,
    dealType: input.dealType,
    listingVisibility: input.listingVisibility,
    dealProgress: input.dealProgress,
    displayOrder: input.displayOrder,
    salePrice: input.salePrice,
    deposit: input.deposit,
    monthlyRent: input.monthlyRent,
    priceNegotiable: input.priceNegotiable,
    brokerFeeNote: input.brokerFeeNote,
    exclusiveArea: String(input.exclusiveArea),
    supplyArea: input.supplyArea === null ? null : String(input.supplyArea),
    floor: input.floor,
    totalFloor: input.totalFloor,
    floorDisplay: input.floorDisplay,
    roomCount: input.roomCount,
    bathCount: input.bathCount,
    direction: input.direction,
    directionBase: input.directionBase,
    moveInDate: input.moveInDate,
    approvalDate: input.approvalDate,
    parkingTotal: input.parkingTotal,
    parkingPerUnit: input.parkingPerUnit === null ? null : String(input.parkingPerUnit),
    buildingUse: input.buildingUse,
    maintenanceFee: input.maintenanceFee,
    maintenanceDetail: input.maintenanceDetail,
    premiumFee: input.premiumFee,
    businessTypeCurrent: input.businessTypeCurrent,
    businessTypeRecommended: input.businessTypeRecommended,
    sido: input.sido,
    sigungu: input.sigungu,
    dong: input.dong,
    bjdCode: input.bjdCode,
    jibunAddress: input.jibunAddress,
    roadAddress: input.roadAddress,
    detailAddress: input.detailAddress,
    lat: input.lat,
    lng: input.lng,
    mapPinMode: input.mapPinMode,
    naverListingNo: input.naverListingNo,
    description: input.description,
    videoUrl: input.videoUrl,
    videoDuration: input.videoDuration,
    videoSummary: input.videoSummary,
    fieldCheckedAt: input.fieldCheckedAt,
  };
}

/** 소명자료용 스냅샷 — 전체 컬럼이 아니라 분쟁에 쓰이는 핵심만.
    ⚠️ 구형 행은 status 키를 갖고 있다(2축 분해 전) — 읽는 쪽은 두 형식을 모두 다룬다 */
function buildLogSnapshot(input: PropertySaveInput) {
  return {
    title: input.title,
    dealType: input.dealType,
    listingVisibility: input.listingVisibility,
    dealProgress: input.dealProgress,
    salePrice: input.salePrice,
    deposit: input.deposit,
    monthlyRent: input.monthlyRent,
    priceNegotiable: input.priceNegotiable,
    // 부당광고 분쟁의 소명자료 — 문구가 이력에 남아야 "그때 뭐라고 썼는지" 증명된다
    brokerFeeNote: input.brokerFeeNote,
    description: input.description,
  };
}

export async function createProperty(
  db: Db,
  adminUserId: number,
  input: PropertySaveInput,
): Promise<{ propertyId: number }> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(properties)
      .values({
        ...toPropertyColumns(input),
        completedAt: input.dealProgress === "COMPLETED" ? new Date() : null,
      })
      .returning({ id: properties.id });

    if (input.optionCodes.length > 0) {
      await tx
        .insert(propertyOptions)
        .values(input.optionCodes.map((optionCode) => ({ propertyId: inserted.id, optionCode })));
    }
    if (input.images.length > 0) {
      await tx.insert(propertyImages).values(
        input.images.map((image, index) => ({
          propertyId: inserted.id,
          filePath: image.filePath,
          thumbPath: image.thumbPath,
          sortOrder: index, // 배열 순서가 곧 정렬 — 0번이 대표 사진
        })),
      );
    }
    await tx.insert(propertyLogs).values({
      propertyId: inserted.id,
      action: "CREATED",
      adminUserId,
      snapshot: buildLogSnapshot(input),
    });
    return { propertyId: inserted.id };
  });
}

export async function updateProperty(
  db: Db,
  adminUserId: number,
  propertyId: number,
  input: PropertySaveInput,
): Promise<void> {
  // 지울 파일 목록만 트랜잭션 안에서 모으고, 실제 파일 삭제는 커밋 후에 한다 —
  // 롤백됐는데 파일만 사라지는 사고를 막는다
  const orphanPaths: string[] = [];

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ dealProgress: properties.dealProgress, completedAt: properties.completedAt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);

    await tx
      .update(properties)
      .set({
        ...toPropertyColumns(input),
        // 이미 거래완료였다면 완료 시각을 덮지 않는다 — 소명자료의 기준 시각 보존
        completedAt:
          input.dealProgress === "COMPLETED"
            ? existing.dealProgress === "COMPLETED"
              ? existing.completedAt
              : new Date()
            : null,
      })
      .where(eq(properties.id, propertyId));

    // 옵션은 전체 교체(멱등) — diff보다 단순하고 21개 상한이라 비용이 없다
    await tx.delete(propertyOptions).where(eq(propertyOptions.propertyId, propertyId));
    if (input.optionCodes.length > 0) {
      await tx
        .insert(propertyOptions)
        .values(input.optionCodes.map((optionCode) => ({ propertyId, optionCode })));
    }

    // 이미지: 제출에 없는 기존 행 삭제 + 신규 삽입 + sortOrder 재부여
    const existingImages = await tx
      .select({
        id: propertyImages.id,
        filePath: propertyImages.filePath,
        thumbPath: propertyImages.thumbPath,
      })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));

    // 제출된 기존 id가 실제 이 매물의 것인지 먼저 확인한다 — 다른 탭이 먼저 사진을
    // 갈아치운 뒤의 낡은 제출을 조용히 반영하면 대표(sortOrder 0) 공백이나
    // 새 사진 전체 삭제(lost-update)로 이어진다(리뷰 확정 major).
    const existingImageIds = new Set(existingImages.map((row) => row.id));
    const submittedIds = input.images
      .filter((image) => image.id !== undefined)
      .map((image) => image.id as number);
    if (submittedIds.some((imageId) => !existingImageIds.has(imageId))) {
      throw new StalePropertyUpdateError();
    }
    const keptImageIds = new Set(submittedIds);
    const removedImages = existingImages.filter((row) => !keptImageIds.has(row.id));
    if (removedImages.length > 0) {
      await tx.delete(propertyImages).where(
        inArray(
          propertyImages.id,
          removedImages.map((row) => row.id),
        ),
      );
      orphanPaths.push(...removedImages.flatMap((row) => [row.filePath, row.thumbPath]));
    }
    for (const [index, image] of input.images.entries()) {
      if (image.id !== undefined) {
        await tx
          .update(propertyImages)
          .set({ sortOrder: index })
          .where(and(eq(propertyImages.id, image.id), eq(propertyImages.propertyId, propertyId)));
      } else {
        await tx.insert(propertyImages).values({
          propertyId,
          filePath: image.filePath,
          thumbPath: image.thumbPath,
          sortOrder: index,
        });
      }
    }

    await tx.insert(propertyLogs).values({
      propertyId,
      action: "UPDATED",
      adminUserId,
      snapshot: buildLogSnapshot(input),
    });
  });

  // 커밋 후 파일 정리 — 실패해도 DB는 이미 정합. "failed"는 콘솔에만 남긴다
  for (const orphanPath of orphanPaths) {
    const deleteResult = await deleteStoredImage(orphanPath);
    if (deleteResult === "failed") {
      console.error(`이미지 파일 삭제 실패(고아 파일): ${orphanPath}`);
    }
  }
}

/**
 * 노출·거래 진행 전환 (A2 일괄 액션·A3 카드2) — 두 축 중 지정한 것만 바꾼다.
 *
 * ⚠️ 법정 게이트는 "직전 상태"가 아니라 **전환 결과**로 판정한다: 결과가 노출(VISIBLE)이면
 * 이번 변경을 반영한 병합값으로 공개 요건을 검사한다. 직전 상태(HIDDEN이었나)로 판정하면
 * 이미 노출 중인 매물의 dealProgress만 바꾸는 호출이 검사를 건너뛴다(정비안 위험 B-1).
 * 순수 함수라 노출 유지 전환에서 반복 실행돼도 비용이 없다.
 */
export async function updatePropertyExposure(
  db: Db,
  adminUserId: number,
  propertyId: number,
  patch: { listingVisibility?: PropertyVisibility; dealProgress?: PropertyDealProgress },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);

    const nextVisibility = patch.listingVisibility ?? existing.listingVisibility;
    const nextProgress = patch.dealProgress ?? existing.dealProgress;
    const visibilityChanged = nextVisibility !== existing.listingVisibility;
    const progressChanged = nextProgress !== existing.dealProgress;
    if (!visibilityChanged && !progressChanged) return; // no-op — 로그를 오염시키지 않는다

    if (nextVisibility === "VISIBLE") {
      const issues = checkPublicationRequirements(existing);
      if (issues.length > 0) {
        throw new PublicationRequirementError(issues.map((issue) => issue.message));
      }
    }

    await tx
      .update(properties)
      .set({
        listingVisibility: nextVisibility,
        dealProgress: nextProgress,
        // 거래완료 진입 시각이 과태료 소명의 기준 — 이미 완료였다면 보존, 이탈하면 비운다.
        // 상세가 동적 렌더라 별도 revalidate 없이 다음 요청부터 즉시 반영된다(RULE-11).
        completedAt:
          nextProgress === "COMPLETED"
            ? existing.dealProgress === "COMPLETED"
              ? existing.completedAt
              : new Date()
            : null,
      })
      .where(eq(properties.id, propertyId));

    // 축별로 이력을 분리해 남긴다 — "노출을 바꿨나 거래단계를 바꿨나"가 소명자료에서 구분돼야 한다
    if (visibilityChanged) {
      await tx.insert(propertyLogs).values({
        propertyId,
        action: "VISIBILITY_CHANGED",
        adminUserId,
        snapshot: { from: existing.listingVisibility, to: nextVisibility },
      });
    }
    if (progressChanged) {
      await tx.insert(propertyLogs).values({
        propertyId,
        action: "DEAL_PROGRESS_CHANGED",
        adminUserId,
        snapshot: { from: existing.dealProgress, to: nextProgress },
      });
    }
  });
}

/**
 * 보관함 이동·복귀 (A2) — 삭제가 아니라 "내려두기"다(설계원칙 2: 삭제 기능을 만들지 않는다).
 * 보관된 매물은 공개 조회에서 빠지지만 데이터·이력은 그대로 남는다.
 */
export async function setPropertyArchived(
  db: Db,
  adminUserId: number,
  propertyId: number,
  archived: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ archivedAt: properties.archivedAt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);
    if ((existing.archivedAt !== null) === archived) return; // no-op

    await tx
      .update(properties)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(properties.id, propertyId));
    await tx.insert(propertyLogs).values({
      propertyId,
      action: archived ? "ARCHIVED" : "UNARCHIVED",
      adminUserId,
      snapshot: null,
    });
  });
}

/** 노출 만료 연장 (A1 '확인'·A2) — 등록 90일 경과 판정 기준 시각을 지금으로 민다 */
export async function renewPropertyExposure(
  db: Db,
  propertyId: number,
): Promise<void> {
  await db
    .update(properties)
    .set({ exposureCheckedAt: new Date() })
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
}

export async function softDeleteProperty(
  db: Db,
  adminUserId: number,
  propertyId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);
    await tx
      .update(properties)
      .set({ deletedAt: new Date() })
      .where(eq(properties.id, propertyId));
    await tx.insert(propertyLogs).values({
      propertyId,
      action: "DELETED",
      adminUserId,
      snapshot: null,
    });
  });
}
