"use client";

import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { use } from "react";

import type { MaintenanceDraft } from "../../../../_components/MaintenanceFeeEditor";
import { PropertyForm, type FormDraft } from "../../../../_components/PropertyForm";
import { MAINTENANCE_GROUPS } from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

/** DB 행 → 폼 draft(문자열) 변환. numeric은 이미 string으로 오고 date 컬럼도 string이다 */
function buildDraftFromDetail(detail: {
  property: Record<string, unknown>;
  images: { id: number; filePath: string; thumbPath: string }[];
  optionCodes: FormDraft["optionCodes"];
}): FormDraft {
  const property = detail.property as {
    title: string;
    buildingType: FormDraft["buildingType"];
    dealType: FormDraft["dealType"];
    listingVisibility: FormDraft["listingVisibility"];
    dealProgress: FormDraft["dealProgress"];
    displayOrder: number;
    priceNegotiable: boolean;
    brokerFeeNote: string | null;
    mapPinMode: FormDraft["mapPinMode"];
    naverListingNo: string | null;
    salePrice: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    exclusiveArea: string;
    supplyArea: string | null;
    floor: number | null;
    totalFloor: number;
    floorDisplay: FormDraft["floorDisplay"];
    roomCount: number | null;
    bathCount: number | null;
    direction: FormDraft["direction"] | null;
    directionBase: string | null;
    moveInDate: string | null;
    approvalDate: string | null;
    parkingTotal: number | null;
    parkingPerUnit: string | null;
    buildingUse: string | null;
    maintenanceFee: number | null;
    maintenanceDetail: Record<string, { item: string; amount: number }[]> | null;
    premiumFee: number | null;
    businessTypeCurrent: string | null;
    businessTypeRecommended: string | null;
    sido: string;
    sigungu: string;
    dong: string;
    bjdCode: string;
    jibunAddress: string;
    roadAddress: string | null;
    detailAddress: string | null;
    lat: number;
    lng: number;
    description: string;
    videoUrl: string | null;
    videoDuration: string | null;
    videoSummary: string | null;
    fieldCheckedAt: string | null;
  };

  const numberToText = (value: number | null) => (value === null ? "" : String(value));
  const textOrEmpty = (value: string | null) => value ?? "";

  const maintenanceDraft: MaintenanceDraft = {
    GENERAL: [],
    USAGE: [],
    ETC: [],
  };
  if (property.maintenanceDetail) {
    for (const group of MAINTENANCE_GROUPS) {
      maintenanceDraft[group] = (property.maintenanceDetail[group] ?? []).map((row) => ({
        item: row.item,
        amountText: String(row.amount),
      }));
    }
  }

  return {
    title: property.title,
    buildingType: property.buildingType,
    dealType: property.dealType,
    listingVisibility: property.listingVisibility,
    dealProgress: property.dealProgress,
    displayOrder: String(property.displayOrder),
    priceNegotiable: property.priceNegotiable,
    brokerFeeNote: textOrEmpty(property.brokerFeeNote),
    mapPinMode: property.mapPinMode,
    naverListingNo: textOrEmpty(property.naverListingNo),
    salePrice: numberToText(property.salePrice),
    deposit: numberToText(property.deposit),
    monthlyRent: numberToText(property.monthlyRent),
    exclusiveArea: property.exclusiveArea,
    supplyArea: textOrEmpty(property.supplyArea),
    floor: numberToText(property.floor),
    totalFloor: String(property.totalFloor),
    floorDisplay: property.floorDisplay,
    roomCount: numberToText(property.roomCount),
    bathCount: numberToText(property.bathCount),
    direction: property.direction ?? "",
    directionBase: textOrEmpty(property.directionBase),
    moveInDate: textOrEmpty(property.moveInDate),
    approvalDate: textOrEmpty(property.approvalDate),
    parkingTotal: numberToText(property.parkingTotal),
    parkingPerUnit: textOrEmpty(property.parkingPerUnit),
    buildingUse: textOrEmpty(property.buildingUse),
    maintenanceFee: numberToText(property.maintenanceFee),
    maintenanceDraft,
    premiumFee: numberToText(property.premiumFee),
    businessTypeCurrent: textOrEmpty(property.businessTypeCurrent),
    businessTypeRecommended: textOrEmpty(property.businessTypeRecommended),
    sido: property.sido,
    sigungu: property.sigungu,
    dong: property.dong,
    bjdCode: property.bjdCode,
    jibunAddress: property.jibunAddress,
    roadAddress: textOrEmpty(property.roadAddress),
    detailAddress: textOrEmpty(property.detailAddress),
    lat: String(property.lat),
    lng: String(property.lng),
    description: property.description,
    videoUrl: textOrEmpty(property.videoUrl),
    videoDuration: textOrEmpty(property.videoDuration),
    videoSummary: textOrEmpty(property.videoSummary),
    fieldCheckedAt: textOrEmpty(property.fieldCheckedAt),
    optionCodes: detail.optionCodes,
    images: detail.images.map((image) => ({
      id: image.id,
      filePath: image.filePath,
      thumbPath: image.thumbPath,
    })),
  };
}

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const propertyId = Number(id);
  const trpc = useTRPC();
  const detail = useQuery(
    trpc.admin.property.detail.queryOptions(
      { propertyId },
      { enabled: Number.isInteger(propertyId) && propertyId > 0, retry: false },
    ),
  );

  if (!Number.isInteger(propertyId) || propertyId <= 0) notFound();

  return (
    <main>
      {detail.isPending && <p className="text-sm text-[#98a2b3]">불러오는 중…</p>}
      {detail.isError && (
        <p role="alert" className="text-sm text-[#d92d20]">
          {detail.error.message}
        </p>
      )}
      {detail.data && (
        <PropertyForm
          mode="edit"
          propertyId={propertyId}
          initialDraft={buildDraftFromDetail(detail.data)}
        />
      )}
    </main>
  );
}
