"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  FileText,
  ImagePlus,
  LayoutGrid,
  ListChecks,
  MapPin,
  MapPinned,
  Receipt,
  Ruler,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatPropertyPrice } from "@/domain/price";
import { isResidential, propertySaveSchema } from "@/domain/property-schema";
import { checkPublicationRequirements } from "@/domain/publication-requirements";
import {
  BUILDING_TYPE_LABEL,
  BUILDING_TYPES,
  DEAL_TYPE_LABEL,
  DEAL_TYPES,
  DIRECTION_LABEL,
  DIRECTIONS,
  FLOOR_RULE_BY_BUILDING_TYPE,
  MAINTENANCE_GROUPS,
  PROPERTY_OPTION_LABEL,
  PROPERTY_OPTIONS,
  type BuildingType,
  type DealType,
  type Direction,
  type FloorDisplay,
  type MaintenanceDetail,
  type PropertyOption,
  MAP_PIN_MODE_LABEL,
  MAP_PIN_MODES,
  type MapPinMode,
  type PropertyDealProgress,
  type PropertyVisibility,
} from "@/lib/codes";
import { useTRPC } from "@/trpc/client";

import {
  ChipGroup,
  FieldError,
  FieldLabel,
  GroupHeader,
  INPUT_CLASS,
  NO_SPINNER,
  SectionCard,
  Stepper,
  type ChipOption,
} from "./FormKit";
import { ImageUploader, type FormImage } from "./ImageUploader";
import {
  EMPTY_MAINTENANCE_DRAFT,
  MaintenanceFeeEditor,
  type MaintenanceDraft,
} from "./MaintenanceFeeEditor";

/**
 * 매물 등록·수정 공유 폼 — 화면 구성은 명율 "매물 등록/수정 UX 고도화"를 차용
 * (SectionCard 섹션 + 우측 앵커 목차 + 칩·스테퍼 + sticky 저장바).
 * **필드 구성·법정 검증은 oh4989 기획 그대로다** — 편집 중 상태(draft)는 전부 문자열이고,
 * 제출 시 toPayload로 변환해 propertySaveSchema(서버 라우터와 같은 스키마)가 유일하게 판정한다.
 */

export type FormDraft = {
  title: string;
  buildingType: BuildingType;
  dealType: DealType;
  /* 노출·거래 진행 2축 (A3 카드2) + 진열 순서 */
  listingVisibility: PropertyVisibility;
  dealProgress: PropertyDealProgress;
  displayOrder: string;
  salePrice: string;
  deposit: string;
  monthlyRent: string;
  priceNegotiable: boolean;
  brokerFeeNote: string;
  exclusiveArea: string;
  supplyArea: string;
  floor: string;
  totalFloor: string;
  floorDisplay: FloorDisplay;
  roomCount: string;
  bathCount: string;
  direction: Direction | "";
  directionBase: string;
  moveInDate: string;
  approvalDate: string;
  parkingTotal: string;
  parkingPerUnit: string;
  buildingUse: string;
  maintenanceFee: string;
  maintenanceDraft: MaintenanceDraft;
  premiumFee: string;
  businessTypeCurrent: string;
  businessTypeRecommended: string;
  sido: string;
  sigungu: string;
  dong: string;
  bjdCode: string;
  jibunAddress: string;
  roadAddress: string;
  detailAddress: string;
  lat: string;
  lng: string;
  mapPinMode: MapPinMode;
  naverListingNo: string;
  description: string;
  videoUrl: string;
  videoDuration: string;
  videoSummary: string;
  fieldCheckedAt: string;
  optionCodes: PropertyOption[];
  images: FormImage[];
};

export const EMPTY_DRAFT: FormDraft = {
  title: "",
  buildingType: "APT",
  dealType: "SALE",
  listingVisibility: "VISIBLE",
  dealProgress: "AVAILABLE",
  displayOrder: "0",
  salePrice: "",
  deposit: "",
  monthlyRent: "",
  priceNegotiable: false,
  brokerFeeNote: "",
  exclusiveArea: "",
  supplyArea: "",
  floor: "",
  totalFloor: "",
  floorDisplay: "EXACT",
  roomCount: "",
  bathCount: "",
  direction: "",
  directionBase: "",
  moveInDate: "",
  approvalDate: "",
  parkingTotal: "",
  parkingPerUnit: "",
  buildingUse: "",
  maintenanceFee: "",
  maintenanceDraft: EMPTY_MAINTENANCE_DRAFT,
  premiumFee: "",
  businessTypeCurrent: "",
  businessTypeRecommended: "",
  sido: "",
  sigungu: "",
  dong: "",
  bjdCode: "",
  jibunAddress: "",
  roadAddress: "",
  detailAddress: "",
  lat: "",
  lng: "",
  mapPinMode: "EXACT",
  naverListingNo: "",
  description: "",
  videoUrl: "",
  videoDuration: "",
  videoSummary: "",
  fieldCheckedAt: "",
  optionCodes: [],
  images: [],
};

/* ── 칩 옵션 (값은 codes.ts 코드값 그대로 — DB 저장값이 바뀌면 안 된다) ── */

const DEAL_CHIPS: ChipOption[] = DEAL_TYPES.map((value) => ({
  value,
  label: DEAL_TYPE_LABEL[value],
}));
const BUILDING_CHIPS: ChipOption[] = BUILDING_TYPES.map((value) => ({
  value,
  label: BUILDING_TYPE_LABEL[value],
}));
/* 노출/거래 진행 — 확정 기획 A3 카드2: 두 축을 별도 그룹으로 둔다(단일 상태 칩 금지) */
const VISIBILITY_CHIPS: ChipOption[] = [
  { value: "VISIBLE", label: "노출", color: "#1570ef", tint: "#eff8ff", dot: true },
  { value: "HIDDEN", label: "숨김 (작성 중)", color: "#b54708", tint: "#fffaeb", dot: true },
];
const PROGRESS_CHIPS: ChipOption[] = [
  { value: "AVAILABLE", label: "거래중", color: "#067647", tint: "#ecfdf3", dot: true },
  { value: "UNDER_CONTRACT", label: "계약중", color: "#b54708", tint: "#fffaeb", dot: true },
  { value: "COMPLETED", label: "거래완료", color: "#667085", tint: "#f2f4f7", dot: true },
];
const FLOOR_DISPLAY_CHIPS: ChipOption[] = [
  { value: "EXACT", label: "정확히 (3/15층)" },
  { value: "LOW_MID_HIGH", label: "저/중/고 (의뢰인 요청 시)" },
];

// 우측 레일 섹션 목차 — SectionCard id와 1:1 (명율 SECTION_LINKS 방식)
/** 확정 기획 A3의 카드 순서 — 우측 레일 목차와 1:1 */
const SECTION_LINKS = [
  { id: "sec-basic", label: "매물 정보" },
  { id: "sec-exposure", label: "노출 제어" },
  { id: "sec-price", label: "가격" },
  { id: "sec-area", label: "면적 · 층" },
  { id: "sec-spec", label: "상세 스펙" },
  { id: "sec-fee", label: "관리비" },
  { id: "sec-addr", label: "위치" },
  { id: "sec-coord", label: "좌표 · 지도" },
  { id: "sec-desc", label: "특징 · 영상" },
  { id: "sec-options", label: "옵션" },
  { id: "sec-photos", label: "사진" },
];

/** 중개보수 안내 문구 프리셋 (확정 기획 A3 카드3 — 원문) */
const BROKER_FEE_PRESETS = [
  "법정 상한요율 적용 · 협의",
  "상가 0.9% 이내 협의 · 부가세 별도",
  "실비(등기·세무) 별도",
];

/** 진열 순서 프리셋 (확정: 최상단 -10 / 기본 0 / 후순위 100) */
const DISPLAY_ORDER_PRESETS = [
  { label: "최상단", value: -10 },
  { label: "기본", value: 0 },
  { label: "후순위", value: 100 },
];

function toNullableNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

/** ㎡ 문자열 → "약 N평" 힌트 (명율). 값이 없으면 빈 문자열 */
function pyeongHint(sqmText: string): string {
  const sqm = parseFloat(sqmText);
  if (!isFinite(sqm) || sqm <= 0) return "";
  return `약 ${Math.round(sqm / 3.305785).toLocaleString()}평`;
}

/** draft(문자열) → 스키마 입력 형태. 최종 검증은 propertySaveSchema가 한다 */
function toPayload(draft: FormDraft) {
  const maintenanceRows = MAINTENANCE_GROUPS.flatMap((group) => draft.maintenanceDraft[group]);
  const hasMaintenanceRows = maintenanceRows.some(
    (row) => row.item.trim() !== "" || row.amountText.trim() !== "",
  );
  const maintenanceDetail: MaintenanceDetail | null = hasMaintenanceRows
    ? {
        GENERAL: [],
        USAGE: [],
        ETC: [],
        ...Object.fromEntries(
          MAINTENANCE_GROUPS.map((group) => [
            group,
            draft.maintenanceDraft[group]
              .filter((row) => row.item.trim() !== "" || row.amountText.trim() !== "")
              .map((row) => ({
                item: row.item.trim(),
                amount: toNullableNumber(row.amountText) ?? -1, // -1은 스키마(min 0)가 거부 — 금액 없는 행을 잡는다
              })),
          ]),
        ),
      }
    : null;

  return {
    title: draft.title,
    buildingType: draft.buildingType,
    dealType: draft.dealType,
    listingVisibility: draft.listingVisibility,
    dealProgress: draft.dealProgress,
    displayOrder: toNullableNumber(draft.displayOrder) ?? 0,
    salePrice: toNullableNumber(draft.salePrice),
    deposit: toNullableNumber(draft.deposit),
    monthlyRent: toNullableNumber(draft.monthlyRent),
    priceNegotiable: draft.priceNegotiable,
    brokerFeeNote: toNullableText(draft.brokerFeeNote),
    exclusiveArea: toNullableNumber(draft.exclusiveArea) ?? -1, // notNull 컬럼 — 빈 값은 스키마가 거부
    supplyArea: toNullableNumber(draft.supplyArea),
    floor: toNullableNumber(draft.floor),
    totalFloor: toNullableNumber(draft.totalFloor) ?? -1,
    floorDisplay: draft.floorDisplay,
    roomCount: toNullableNumber(draft.roomCount),
    bathCount: toNullableNumber(draft.bathCount),
    direction: draft.direction === "" ? null : draft.direction,
    directionBase: toNullableText(draft.directionBase),
    moveInDate: toNullableText(draft.moveInDate),
    approvalDate: toNullableText(draft.approvalDate),
    parkingTotal: toNullableNumber(draft.parkingTotal),
    parkingPerUnit: toNullableNumber(draft.parkingPerUnit),
    buildingUse: toNullableText(draft.buildingUse),
    maintenanceFee: toNullableNumber(draft.maintenanceFee),
    maintenanceDetail,
    premiumFee: toNullableNumber(draft.premiumFee),
    businessTypeCurrent: toNullableText(draft.businessTypeCurrent),
    businessTypeRecommended: toNullableText(draft.businessTypeRecommended),
    sido: draft.sido,
    sigungu: draft.sigungu,
    dong: draft.dong,
    bjdCode: draft.bjdCode.trim(),
    jibunAddress: draft.jibunAddress,
    roadAddress: toNullableText(draft.roadAddress),
    detailAddress: toNullableText(draft.detailAddress),
    lat: toNullableNumber(draft.lat) ?? -1,
    lng: toNullableNumber(draft.lng) ?? -1,
    mapPinMode: draft.mapPinMode,
    naverListingNo: toNullableText(draft.naverListingNo),
    description: draft.description,
    videoUrl: toNullableText(draft.videoUrl),
    videoDuration: toNullableText(draft.videoDuration),
    videoSummary: toNullableText(draft.videoSummary),
    fieldCheckedAt: toNullableText(draft.fieldCheckedAt),
    optionCodes: draft.optionCodes,
    images: draft.images,
  };
}

/* ── 파일 내 전용 입력 조각 ── */

function TextField(props: {
  label: string;
  name: string;
  value: string;
  onChange: (nextValue: string) => void;
  error?: string;
  placeholder?: string;
  type?: "text" | "date" | "number";
  hint?: string;
  unit?: string;
  required?: boolean;
  step?: string;
  /** ㎡ 입력 등 값 옆 실시간 안내 */
  trailingHint?: string;
}) {
  return (
    <label className="block" data-field={props.name}>
      <FieldLabel required={props.required} hint={props.hint} unit={props.unit}>
        {props.label}
      </FieldLabel>
      <div className="relative">
        <input
          type={props.type ?? "text"}
          name={props.name}
          value={props.value}
          step={props.step}
          placeholder={props.placeholder}
          onChange={(event) => props.onChange(event.target.value)}
          className={`${INPUT_CLASS} ${props.type === "number" ? NO_SPINNER : ""}`}
        />
        {props.trailingHint && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-[#2563eb]">
            {props.trailingHint}
          </span>
        )}
      </div>
      <FieldError message={props.error} />
    </label>
  );
}

/* ── 본체 ── */

export function PropertyForm({
  mode,
  propertyId,
  initialDraft,
}: {
  mode: "create" | "edit";
  propertyId?: number;
  initialDraft?: FormDraft;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [draft, setDraft] = useState<FormDraft>(initialDraft ?? EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const floorRule = FLOOR_RULE_BY_BUILDING_TYPE[draft.buildingType];
  const residential = isResidential(draft.buildingType);
  // 권리금·업종은 상가·사무실에만 의미가 있다 (토지·주거형은 섹션 자체를 숨긴다)
  const commercial = draft.buildingType === "STORE" || draft.buildingType === "OFFICE";
  const needsDeposit = draft.dealType !== "SALE";
  const needsMonthlyRent = draft.dealType === "MONTHLY" || draft.dealType === "SHORT";
  const publicRequired = draft.listingVisibility !== "HIDDEN"; // 노출 저장이면 법정 필수 표시(*)

  const patch = (partial: Partial<FormDraft>) =>
    setDraft((currentDraft) => ({ ...currentDraft, ...partial }));

  /* 목록 표기 미리보기 — 손님 화면과 같은 도메인 함수를 쓴다(표기가 갈라지지 않게) */
  const listingPriceText = draft.priceNegotiable
    ? "가격 협의"
    : formatPropertyPrice({
        dealType: draft.dealType,
        salePrice: toNullableNumber(draft.salePrice),
        deposit: toNullableNumber(draft.deposit),
        monthlyRent: toNullableNumber(draft.monthlyRent),
      });

  /* 공개 전 확인 체크리스트 (확정 A3 우측 레일 ③) — 저장 게이트와 **같은 함수**로 판정한다.
     화면 안내와 실제 차단 사유가 어긋나면 대표가 무엇을 고쳐야 할지 알 수 없다. */
  const publicationIssues = checkPublicationRequirements({
    buildingType: draft.buildingType,
    dealType: draft.dealType,
    salePrice: toNullableNumber(draft.salePrice),
    deposit: toNullableNumber(draft.deposit),
    monthlyRent: toNullableNumber(draft.monthlyRent),
    priceNegotiable: draft.priceNegotiable,
    brokerFeeNote: toNullableText(draft.brokerFeeNote),
    floor: toNullableNumber(draft.floor),
    totalFloor: toNullableNumber(draft.totalFloor) ?? 0,
    roomCount: toNullableNumber(draft.roomCount),
    bathCount: toNullableNumber(draft.bathCount),
    direction: draft.direction === "" ? null : draft.direction,
    moveInDate: toNullableText(draft.moveInDate),
    approvalDate: toNullableText(draft.approvalDate),
    parkingTotal: toNullableNumber(draft.parkingTotal),
    buildingUse: toNullableText(draft.buildingUse),
    maintenanceFee: toNullableNumber(draft.maintenanceFee),
    maintenanceDetail: toPayload(draft).maintenanceDetail,
  });
  const hasPhoto = draft.images.length > 0;
  const checklistItems = [
    { itemLabel: "제목", isDone: draft.title.trim() !== "" },
    { itemLabel: "사진", isDone: hasPhoto },
    ...publicationIssues.length === 0
      ? [{ itemLabel: "법정 필수항목", isDone: true }]
      : publicationIssues.map((issue) => ({ itemLabel: issue.message, isDone: false })),
  ];
  const unmetCount = checklistItems.filter((item) => !item.isDone).length;

  const onSaved = () => {
    router.refresh();
    router.replace("/admin/properties");
  };
  const createProperty = useMutation(
    trpc.admin.property.create.mutationOptions({ onSuccess: onSaved }),
  );
  const updateProperty = useMutation(
    trpc.admin.property.update.mutationOptions({ onSuccess: onSaved }),
  );
  const isSaving = createProperty.isPending || updateProperty.isPending;
  const saveError = createProperty.error ?? updateProperty.error;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = propertySaveSchema.safeParse(toPayload(draft));
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const fieldName = String(issue.path[0] ?? "");
        if (fieldName && !nextErrors[fieldName]) nextErrors[fieldName] = issue.message;
      }
      setFieldErrors(nextErrors);
      document
        .querySelector(`[data-field="${Object.keys(nextErrors)[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFieldErrors({});
    if (mode === "create") {
      createProperty.mutate(parsed.data);
    } else if (propertyId !== undefined) {
      updateProperty.mutate({ propertyId, data: parsed.data });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="xl:grid xl:grid-cols-[1fr_170px] xl:gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        {/* ── 기본 정보 ── */}
        <SectionCard
          id="sec-basic"
          icon={<Building2 className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#eff4ff"
          iconColor="#2563eb"
          title="기본 정보"
          subtitle="건물유형에 따라 필수 항목이 달라집니다"
        >
          <div className="flex flex-col gap-4">
            {/* 매물명 강조 패널 (확정 A3 카드1) — 검색 결과·안내서 제목으로 그대로 쓰인다 */}
            <div
              data-field="title"
              className="rounded-xl border border-[#EFEAE0] bg-[#FAF8F4] px-[17px] pt-[15px] pb-[17px]"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-3.5 w-[3px] rounded-[2px] bg-[#146B7C]" />
                <label htmlFor="property-title" className="text-sm font-bold tracking-[-0.2px]">
                  매물명
                </label>
                <span className="rounded-[4px] bg-[#FBEDEA] px-1.5 py-0.5 text-[11px] font-bold text-[#C0392B]">
                  필수
                </span>
                <span className="num ml-auto text-xs font-semibold text-[#96A1A7]">
                  {draft.title.length} / 60
                </span>
              </div>
              <input
                id="property-title"
                name="title"
                value={draft.title}
                maxLength={60}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="예: 배곧 중심상가 1층 코너 · 42.9㎡"
                className="mt-2.5 h-[52px] w-full rounded-[10px] border-[1.5px] border-[#146B7C] bg-white px-4 text-[18px] font-semibold tracking-[-0.3px] text-[#0B2430] shadow-[0_0_0_4px_rgba(20,107,124,0.1)] placeholder:font-normal placeholder:text-[#A79E90]"
              />
              <p className="mt-2 text-xs leading-[1.55] text-[#5C6B72]">
                검색 결과와 안내서 제목으로 쓰입니다 ·{" "}
                <b className="font-bold text-[#146B7C]">지역 + 면적 + 용도 + 특징</b> 순서를
                권합니다
              </p>
              <FieldError message={fieldErrors.title} />
            </div>
            <div data-field="buildingType">
              <FieldLabel required>건물유형</FieldLabel>
              <ChipGroup
                label="건물유형"
                value={draft.buildingType}
                options={BUILDING_CHIPS}
                onChange={(value) => {
                  const nextType = value as BuildingType;
                  patch({
                    buildingType: nextType,
                    // 상가·사무실은 저/중/고 대체 불가(법정) — 선택돼 있던 값을 되돌린다
                    floorDisplay:
                      FLOOR_RULE_BY_BUILDING_TYPE[nextType] === "EXACT_STRICT"
                        ? "EXACT"
                        : draft.floorDisplay,
                  });
                }}
              />
            </div>
            <div data-field="dealType">
              <FieldLabel required>거래유형</FieldLabel>
              <ChipGroup
                label="거래유형"
                value={draft.dealType}
                options={DEAL_CHIPS}
                onChange={(value) => patch({ dealType: value as DealType })}
              />
            </div>
            <TextField
              label="네이버 매물번호"
              name="naverListingNo"
              hint="수기 메모 — 자동 조회는 준비 중"
              value={draft.naverListingNo}
              onChange={(value) => patch({ naverListingNo: value })}
              error={fieldErrors.naverListingNo}
              placeholder="예: 2412345678"
            />
          </div>
        </SectionCard>

        {/* ── 노출 제어 (확정 기획 A3 카드2) ──
            "노출 여부와 거래 단계는 이 카드에서만 정합니다" — 다른 카드에 상태 칩을 두지 않는다 */}
        <SectionCard
          id="sec-exposure"
          icon={<Eye className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#f4f9f8"
          iconColor="#146B7C"
          title="노출 제어"
          subtitle="홈페이지에 보이는지, 어디에 놓이는지"
        >
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1fr_1.1fr]">
            <div
              data-field="listingVisibility"
              className="rounded-xl border border-[#EFEAE0] bg-[#FAF8F4] px-[15px] pt-[13px] pb-[15px]"
            >
              <FieldLabel hint="숨김이면 검색·목록에서 빠집니다">홈페이지 노출</FieldLabel>
              <ChipGroup
                label="홈페이지 노출"
                value={draft.listingVisibility}
                options={VISIBILITY_CHIPS}
                onChange={(value) => patch({ listingVisibility: value as PropertyVisibility })}
              />
            </div>
            <div
              data-field="dealProgress"
              className="rounded-xl border border-[#EFEAE0] bg-[#FAF8F4] px-[15px] pt-[13px] pb-[15px]"
            >
              <FieldLabel hint="목록 카드에 배지로 같이 나갑니다">거래 진행 상태</FieldLabel>
              <ChipGroup
                label="거래 진행 상태"
                value={draft.dealProgress}
                options={PROGRESS_CHIPS}
                onChange={(value) => patch({ dealProgress: value as PropertyDealProgress })}
              />
            </div>
            <div
              data-field="displayOrder"
              className="rounded-xl border border-[#EFEAE0] bg-[#FAF8F4] px-[15px] pt-[13px] pb-[15px]"
            >
              <FieldLabel hint="숫자가 작을수록 목록 위 (-10 ~ 999)">진열 순서</FieldLabel>
              {/* 스테퍼 — 확정: − / 값 / ＋ 한 덩어리 */}
              <div className="flex h-10 w-fit items-stretch overflow-hidden rounded-[9px] border border-[#D4CFC6] bg-white">
                <button
                  type="button"
                  aria-label="진열 순서 낮추기"
                  onClick={() =>
                    patch({
                      displayOrder: String(
                        Math.max(-10, (toNullableNumber(draft.displayOrder) ?? 0) - 1),
                      ),
                    })
                  }
                  className="w-[34px] text-[17px] font-semibold text-[#5C6B72]"
                >
                  −
                </button>
                <input
                  type="number"
                  name="displayOrder"
                  value={draft.displayOrder}
                  onChange={(event) => patch({ displayOrder: event.target.value })}
                  aria-label="진열 순서"
                  className={`num w-[60px] border-x border-[#EFEAE0] text-center text-[15px] font-bold ${NO_SPINNER}`}
                />
                <button
                  type="button"
                  aria-label="진열 순서 높이기"
                  onClick={() =>
                    patch({
                      displayOrder: String(
                        Math.min(999, (toNullableNumber(draft.displayOrder) ?? 0) + 1),
                      ),
                    })
                  }
                  className="w-[34px] text-[17px] font-semibold text-[#5C6B72]"
                >
                  ＋
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DISPLAY_ORDER_PRESETS.map((preset) => {
                  const isOn = (toNullableNumber(draft.displayOrder) ?? 0) === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => patch({ displayOrder: String(preset.value) })}
                      className={`flex min-h-11 items-center rounded-[7px] border px-2.5 text-xs font-semibold ${
                        isOn
                          ? "border-[#146B7C] bg-[#EDF3F1] text-[#146B7C]"
                          : "border-[#E5DFD4] bg-white text-[#7C8990]"
                      }`}
                    >
                      {preset.label} {preset.value}
                    </button>
                  );
                })}
              </div>
              <FieldError message={fieldErrors.displayOrder} />
            </div>
          </div>
        </SectionCard>

        {/* ── 가격 ── */}
        <SectionCard
          id="sec-price"
          icon={<Wallet className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#f6fef9"
          iconColor="#039855"
          title="가격"
          subtitle="만원 단위 정수 — 4억 3,000 = 43000"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {draft.dealType === "SALE" && (
              <TextField
                label="매매가"
                name="salePrice"
                type="number"
                unit="만원"
                required={publicRequired}
                value={draft.salePrice}
                onChange={(value) => patch({ salePrice: value })}
                error={fieldErrors.salePrice}
                placeholder="43000"
              />
            )}
            {needsDeposit && (
              <TextField
                label="보증금"
                name="deposit"
                type="number"
                unit="만원"
                required={publicRequired}
                value={draft.deposit}
                onChange={(value) => patch({ deposit: value })}
                error={fieldErrors.deposit}
                placeholder="30000"
              />
            )}
            {needsMonthlyRent && (
              <TextField
                label="월세"
                name="monthlyRent"
                type="number"
                unit="만원"
                required={publicRequired}
                value={draft.monthlyRent}
                onChange={(value) => patch({ monthlyRent: value })}
                error={fieldErrors.monthlyRent}
                placeholder="45"
              />
            )}
          </div>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm" data-field="priceNegotiable">
            <input
              type="checkbox"
              checked={draft.priceNegotiable}
              onChange={(event) => patch({ priceNegotiable: event.target.checked })}
              className="size-4"
            />
            <span className="font-semibold text-[#344054]">가격 협의</span>
            <span className="text-xs text-[#98a2b3]">
              — 켜면 금액 없이 공개할 수 있습니다(화면에 &ldquo;가격 협의&rdquo;로 표기)
            </span>
          </label>
          {/* 목록 표기 요약 바 (확정 A3 카드3) — 입력값이 손님 화면에 어떻게 나가는지 즉시 확인 */}
          <div className="mt-3 flex items-center gap-2 rounded-[9px] border border-[#EFEAE0] bg-[#FAF8F4] px-[13px] py-2.5">
            <span aria-hidden className="text-xs text-[#96A1A7]">
              ⓘ
            </span>
            <span className="text-[12.5px] text-[#5C6B72]">
              목록 표기{" "}
              <b className="num font-bold text-[#0B2430]">{listingPriceText}</b>
            </span>
          </div>

          <div className="mt-3" data-field="brokerFeeNote">
            <TextField
              label="중개보수 안내 문구"
              name="brokerFeeNote"
              required={publicRequired}
              hint="법정 필수 — 공개 저장 시 비어 있으면 저장이 막힙니다"
              value={draft.brokerFeeNote}
              onChange={(value) => patch({ brokerFeeNote: value })}
              error={fieldErrors.brokerFeeNote}
              placeholder="중개보수와 실비 부담 기준을 적어주세요 — 비우면 공개 저장이 막힙니다"
            />
            {/* 자주 쓰는 문구 프리셋 3종 (확정 원문) */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BROKER_FEE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => patch({ brokerFeeNote: preset })}
                  className="flex min-h-11 items-center rounded-lg border border-[#D4CFC6] bg-white px-3 text-xs font-semibold text-[#5C6B72] hover:border-[#146B7C] hover:text-[#146B7C]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── 면적 · 층 ── */}
        <SectionCard
          id="sec-area"
          icon={<Ruler className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#fef6ee"
          iconColor="#b93815"
          title="면적 · 층"
        >
          <GroupHeader>면적</GroupHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="전용면적"
              name="exclusiveArea"
              type="number"
              step="0.1"
              unit="㎡"
              required
              value={draft.exclusiveArea}
              onChange={(value) => patch({ exclusiveArea: value })}
              error={fieldErrors.exclusiveArea}
              placeholder="84.9"
              trailingHint={pyeongHint(draft.exclusiveArea)}
            />
            <TextField
              label="공급면적"
              name="supplyArea"
              type="number"
              step="0.1"
              unit="㎡"
              hint="선택"
              value={draft.supplyArea}
              onChange={(value) => patch({ supplyArea: value })}
              error={fieldErrors.supplyArea}
              trailingHint={pyeongHint(draft.supplyArea)}
            />
          </div>
          <div className="mt-5">
            <GroupHeader>층 — {BUILDING_TYPE_LABEL[draft.buildingType]} 기준</GroupHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {floorRule !== "TOTAL_ONLY" && (
                <TextField
                  label="해당 층"
                  name="floor"
                  type="number"
                  required={publicRequired}
                  hint="지하는 음수 (지하1층 = -1)"
                  value={draft.floor}
                  onChange={(value) => patch({ floor: value })}
                  error={fieldErrors.floor}
                  placeholder="3"
                />
              )}
              <TextField
                label="총 층수"
                name="totalFloor"
                type="number"
                required
                value={draft.totalFloor}
                onChange={(value) => patch({ totalFloor: value })}
                error={fieldErrors.totalFloor}
                placeholder="15"
              />
            </div>
            {floorRule === "EXACT" && (
              <div className="mt-4" data-field="floorDisplay">
                <FieldLabel>층 표기 방식</FieldLabel>
                <ChipGroup
                  label="층 표기 방식"
                  value={draft.floorDisplay}
                  options={FLOOR_DISPLAY_CHIPS}
                  onChange={(value) => patch({ floorDisplay: value as FloorDisplay })}
                />
                <FieldError message={fieldErrors.floorDisplay} />
              </div>
            )}
            {floorRule === "TOTAL_ONLY" && (
              <p className="mt-3 text-xs text-[#98a2b3]">
                단독·다가구·토지는 총 층수만 표기합니다(법정) — 해당 층 입력이 없습니다.
              </p>
            )}
            {floorRule === "EXACT_STRICT" && (
              <p className="mt-3 text-xs text-[#98a2b3]">
                상가·사무실은 해당층/총층을 정확히 표기해야 합니다(법정) — 저/중/고 대체 불가.
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── 상세 스펙 ── */}
        <SectionCard
          id="sec-spec"
          icon={<LayoutGrid className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#f4f3ff"
          iconColor="#6938ef"
          title="상세 스펙"
          subtitle={residential ? undefined : "상가·사무실·토지는 방·욕실·방향 입력이 없습니다"}
        >
          {residential && (
            <>
              <GroupHeader>방 · 욕실 · 방향</GroupHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div data-field="roomCount">
                  <FieldLabel required={publicRequired}>방 수</FieldLabel>
                  <Stepper
                    value={toNullableNumber(draft.roomCount) ?? 0}
                    onChange={(next) => patch({ roomCount: String(next) })}
                    min={0}
                    max={50}
                    presets={[
                      { label: "원룸", value: 1 },
                      { label: "투룸", value: 2 },
                      { label: "3룸", value: 3 },
                    ]}
                  />
                  <FieldError message={fieldErrors.roomCount} />
                </div>
                <div data-field="bathCount">
                  <FieldLabel required={publicRequired}>욕실 수</FieldLabel>
                  <Stepper
                    value={toNullableNumber(draft.bathCount) ?? 0}
                    onChange={(next) => patch({ bathCount: String(next) })}
                    min={0}
                    max={50}
                    presets={[
                      { label: "1개", value: 1 },
                      { label: "2개", value: 2 },
                    ]}
                  />
                  <FieldError message={fieldErrors.bathCount} />
                </div>
                <label className="block" data-field="direction">
                  <FieldLabel required={publicRequired}>방향</FieldLabel>
                  <select
                    name="direction"
                    value={draft.direction}
                    onChange={(event) =>
                      patch({ direction: event.target.value as Direction | "" })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">선택</option>
                    {DIRECTIONS.map((direction) => (
                      <option key={direction} value={direction}>
                        {DIRECTION_LABEL[direction]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.direction} />
                </label>
                <TextField
                  label="방향 기준"
                  name="directionBase"
                  hint="선택 — 상세에 '남향 (안방 기준)'으로 표기"
                  value={draft.directionBase}
                  onChange={(value) => patch({ directionBase: value })}
                  placeholder="안방 / 거실"
                />
              </div>
              <div className="mt-5" />
            </>
          )}
          {commercial && (
            <>
              <GroupHeader>상가 정보 — 선택 입력</GroupHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  label="권리금"
                  name="premiumFee"
                  type="number"
                  unit="만원"
                  hint="없으면 0 — '없음'으로 표기됩니다"
                  value={draft.premiumFee}
                  onChange={(value) => patch({ premiumFee: value })}
                  error={fieldErrors.premiumFee}
                  placeholder="3000"
                />
                <TextField
                  label="현재업종"
                  name="businessTypeCurrent"
                  value={draft.businessTypeCurrent}
                  onChange={(value) => patch({ businessTypeCurrent: value })}
                  error={fieldErrors.businessTypeCurrent}
                  placeholder="공실 / 카페"
                />
                <TextField
                  label="추천업종"
                  name="businessTypeRecommended"
                  value={draft.businessTypeRecommended}
                  onChange={(value) => patch({ businessTypeRecommended: value })}
                  error={fieldErrors.businessTypeRecommended}
                  placeholder="주점 치킨 패스트푸드"
                />
              </div>
              <div className="mt-5" />
            </>
          )}
          <GroupHeader>일정 · 건축물</GroupHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="입주가능일"
              name="moveInDate"
              required={publicRequired}
              value={draft.moveInDate}
              onChange={(value) => patch({ moveInDate: value })}
              error={fieldErrors.moveInDate}
              placeholder="즉시입주 또는 2026-09-01"
            />
            <TextField
              label="행정기관 승인일자"
              name="approvalDate"
              type="date"
              required={publicRequired}
              value={draft.approvalDate}
              onChange={(value) => patch({ approvalDate: value })}
              error={fieldErrors.approvalDate}
            />
            <TextField
              label="건축물 용도"
              name="buildingUse"
              required={publicRequired}
              value={draft.buildingUse}
              onChange={(value) => patch({ buildingUse: value })}
              error={fieldErrors.buildingUse}
              placeholder="공동주택 / 제2종근린생활시설"
            />
            <TextField
              label="현장 확인일"
              name="fieldCheckedAt"
              type="date"
              hint="선택 — 상세에 신뢰 배지로 표시"
              value={draft.fieldCheckedAt}
              onChange={(value) => patch({ fieldCheckedAt: value })}
              error={fieldErrors.fieldCheckedAt}
            />
            <TextField
              label="총 주차대수"
              name="parkingTotal"
              type="number"
              unit="대"
              required={publicRequired}
              value={draft.parkingTotal}
              onChange={(value) => patch({ parkingTotal: value })}
              error={fieldErrors.parkingTotal}
            />
            <TextField
              label="세대당 주차"
              name="parkingPerUnit"
              type="number"
              step="0.1"
              unit="대"
              hint="선택"
              value={draft.parkingPerUnit}
              onChange={(value) => patch({ parkingPerUnit: value })}
              error={fieldErrors.parkingPerUnit}
              placeholder="1.2"
            />
          </div>
        </SectionCard>

        {/* ── 관리비 ── */}
        <SectionCard
          id="sec-fee"
          icon={<Receipt className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#fff6ed"
          iconColor="#b54708"
          title="관리비"
          subtitle="일반 / 사용료 / 기타 3구분은 법정 의무입니다"
        >
          <TextField
            label="관리비 총액"
            name="maintenanceFee"
            type="number"
            unit="만원"
            required={publicRequired}
            hint="없으면 0"
            value={draft.maintenanceFee}
            onChange={(value) => patch({ maintenanceFee: value })}
            error={fieldErrors.maintenanceFee}
            placeholder="10"
          />
          <div className="mt-4" data-field="maintenanceDetail">
            <MaintenanceFeeEditor
              value={draft.maintenanceDraft}
              onChange={(nextDraft) => patch({ maintenanceDraft: nextDraft })}
            />
            <FieldError message={fieldErrors.maintenanceDetail} />
          </div>
        </SectionCard>

        {/* ── 주소 ── */}
        <SectionCard
          id="sec-addr"
          icon={<MapPin className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#eff8ff"
          iconColor="#1570ef"
          title="위치"
          subtitle="공개 소재지는 동까지만, 상세 주소는 사무실 내부용입니다"
        >
          {/* 공개/비공개 대비 — 확정 A3 카드6: 공개는 틸 계열, 비공개는 적색 계열로 눈에 띄게 가른다 */}
          <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#C7DDD8] bg-[#F7FBFA] p-3.5">
              <span className="inline-flex rounded-[4px] bg-[#EDF3F1] px-1.5 py-0.5 text-[11px] font-bold text-[#146B7C]">
                공개
              </span>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[#5C6B72]">
                아래 <b>시/도 · 시/군/구 · 읍/면/동</b>까지만 손님 화면에 나갑니다.
              </p>
            </div>
            <div className="rounded-xl border border-[#F3D9D3] bg-[#FFFBFA] p-3.5">
              <span className="inline-flex rounded-[4px] bg-[#FBEDEA] px-1.5 py-0.5 text-[11px] font-bold text-[#C0392B]">
                비공개
              </span>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[#8E2D22]">
                <b>상세 주소</b>는 공개 화면에 절대 나가지 않습니다. 사무실 내부 확인용입니다.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="시/도"
              name="sido"
              required
              value={draft.sido}
              onChange={(value) => patch({ sido: value })}
              error={fieldErrors.sido}
              placeholder="경기"
            />
            <TextField
              label="시/군/구"
              name="sigungu"
              required
              value={draft.sigungu}
              onChange={(value) => patch({ sigungu: value })}
              error={fieldErrors.sigungu}
              placeholder="시흥시"
            />
            <TextField
              label="읍/면/동"
              name="dong"
              required
              value={draft.dong}
              onChange={(value) => patch({ dong: value })}
              error={fieldErrors.dong}
              placeholder="배곧동"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="법정동코드"
              name="bjdCode"
              required
              hint="숫자 10자리"
              value={draft.bjdCode}
              onChange={(value) => patch({ bjdCode: value })}
              error={fieldErrors.bjdCode}
              placeholder="4139013200 (배곧동)"
            />
            <TextField
              label="지번 주소"
              name="jibunAddress"
              required
              value={draft.jibunAddress}
              onChange={(value) => patch({ jibunAddress: value })}
              error={fieldErrors.jibunAddress}
              placeholder="경기 시흥시 배곧동 123-4"
            />
            <TextField
              label="도로명 주소"
              name="roadAddress"
              hint="선택"
              value={draft.roadAddress}
              onChange={(value) => patch({ roadAddress: value })}
              error={fieldErrors.roadAddress}
            />
            <TextField
              label="상세 주소"
              name="detailAddress"
              hint="⚠️ 공개 화면에는 절대 표시되지 않습니다"
              value={draft.detailAddress}
              onChange={(value) => patch({ detailAddress: value })}
              error={fieldErrors.detailAddress}
            />
          </div>
        </SectionCard>

        {/* ── 좌표 ── */}
        <SectionCard
          id="sec-coord"
          icon={<MapPinned className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#f0fdf9"
          iconColor="#107569"
          title="좌표 · 지도"
          subtitle="네이버 지도에서 위치를 찍어 좌표를 옮겨 적습니다"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="위도 (lat)"
              name="lat"
              type="number"
              step="0.000001"
              required
              value={draft.lat}
              onChange={(value) => patch({ lat: value })}
              error={fieldErrors.lat}
              placeholder="37.3799"
            />
            <TextField
              label="경도 (lng)"
              name="lng"
              type="number"
              step="0.000001"
              required
              value={draft.lng}
              onChange={(value) => patch({ lng: value })}
              error={fieldErrors.lng}
              placeholder="126.7291"
            />
          </div>
          {/* 지도 핀 표시 (A3 카드6) — 좌표는 실제 값으로 저장되고 공개 응답만 치환된다 */}
          <div className="mt-3" data-field="mapPinMode">
            <FieldLabel hint="동 중심을 고르면 손님 지도에는 대략 위치만 표시됩니다">
              지도 핀 표시
            </FieldLabel>
            <ChipGroup
              label="지도 핀 표시"
              value={draft.mapPinMode}
              options={MAP_PIN_MODES.map((value) => ({
                value,
                label: MAP_PIN_MODE_LABEL[value],
              }))}
              onChange={(value) => patch({ mapPinMode: value as MapPinMode })}
            />
          </div>
        </SectionCard>

        {/* ── 특징 · 영상 ── */}
        <SectionCard
          id="sec-desc"
          icon={<FileText className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#f2f4f7"
          iconColor="#475467"
          title="매물 특징 · 영상"
        >
          <label className="block" data-field="description">
            <FieldLabel hint="과장 문구(최저가·급매 확실 등)는 부당 표시·광고입니다">
              매물 특징
            </FieldLabel>
            <textarea
              name="description"
              rows={5}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="w-full rounded-[9px] border border-[#d0d5dd] bg-white px-3 py-2.5 text-[14px] text-[#101828] placeholder:text-[#98a2b3] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus:outline-none"
              placeholder="입지·구조·채광 등 사실 위주로 적어주세요."
            />
            <FieldError message={fieldErrors.description} />
          </label>
          <div className="mt-4">
            <GroupHeader>YouTube 영상 (선택 — 일부공개 링크)</GroupHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label="영상 URL"
                name="videoUrl"
                value={draft.videoUrl}
                onChange={(value) => patch({ videoUrl: value })}
                error={fieldErrors.videoUrl}
                placeholder="https://youtu.be/..."
              />
              <TextField
                label="영상 길이"
                name="videoDuration"
                value={draft.videoDuration}
                onChange={(value) => patch({ videoDuration: value })}
                error={fieldErrors.videoDuration}
                placeholder="0:48"
              />
              <TextField
                label="요약 자막"
                name="videoSummary"
                hint="무음 시청자용 한 줄"
                value={draft.videoSummary}
                onChange={(value) => patch({ videoSummary: value })}
                error={fieldErrors.videoSummary}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── 옵션 ── */}
        <SectionCard
          id="sec-options"
          icon={<ListChecks className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#eff4ff"
          iconColor="#2563eb"
          title="옵션"
          right={
            <span className="text-xs font-semibold text-[#98a2b3]">
              {draft.optionCodes.length} / {PROPERTY_OPTIONS.length}
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PROPERTY_OPTIONS.map((optionCode) => {
              const checked = draft.optionCodes.includes(optionCode);
              return (
                <label
                  key={optionCode}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[9px] border px-3 text-[13.5px] transition-colors ${
                    checked
                      ? "border-[#2563eb] bg-[#eff4ff] font-bold text-[#2563eb]"
                      : "border-[#e4e7ec] bg-white font-medium text-[#475467] hover:bg-[#f9fafb]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) =>
                      patch({
                        optionCodes: event.target.checked
                          ? [...draft.optionCodes, optionCode]
                          : draft.optionCodes.filter((code) => code !== optionCode),
                      })
                    }
                  />
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] font-black text-white ${
                      checked ? "border-[#2563eb] bg-[#2563eb]" : "border-[#d0d5dd] bg-white"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  {PROPERTY_OPTION_LABEL[optionCode]}
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* ── 사진 ── */}
        <SectionCard
          id="sec-photos"
          icon={<ImagePlus className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          iconBg="#fdf2fa"
          iconColor="#c11574"
          title="사진"
          subtitle="첫 번째 사진이 대표 사진입니다"
          right={
            <span className="text-xs font-semibold text-[#98a2b3]">{draft.images.length}장</span>
          }
        >
          <div data-field="images">
            <ImageUploader
              value={draft.images}
              onChange={(nextImages) => patch({ images: nextImages })}
            />
            <FieldError message={fieldErrors.images} />
          </div>
        </SectionCard>

        {saveError && (
          <p
            role="alert"
            className="rounded-[14px] border border-[#fecdca] bg-[#fef3f2] p-4 text-sm font-semibold text-[#d92d20]"
          >
            저장 실패: {saveError.message}
          </p>
        )}

        {/* ── sticky 저장바 ── */}
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 rounded-t-[14px] border-t border-[#e4e7ec] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(16,24,40,.06)] backdrop-blur-[6px]">
          <p className="hidden text-xs text-[#667085] sm:block">
            {draft.listingVisibility === "HIDDEN"
              ? "작성 중(숨김) 저장 — 법정 필수 검증을 건너뜁니다"
              : "노출 저장 — 법정 필수항목이 모두 있어야 저장됩니다"}
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="ml-auto h-11 rounded-[9px] bg-[#2563eb] px-6 text-[14.5px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {isSaving ? "저장 중…" : mode === "create" ? "매물 등록" : "수정 저장"}
          </button>
        </div>
      </div>

      {/* ── 우측 레일 (xl≥1280px) — 확정 A3: ① 섹션 목차 ② 공개 전 확인 ── */}
      <div className="hidden xl:block">
        <div className="sticky top-[92px] flex flex-col gap-3">
          <nav aria-label="폼 섹션 목차">
            <ol className="flex flex-col gap-0.5 rounded-[14px] border border-[#E5DFD4] bg-white p-2">
              {SECTION_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className="block rounded-[7px] px-3 py-1.5 text-[13px] font-semibold text-[#5C6B72] hover:bg-[#F7F4EE] hover:text-[#0B2430]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* 공개 전 확인 — 저장 게이트와 같은 함수로 판정하므로 화면 안내와 차단 사유가 항상 일치한다 */}
          <section className="rounded-[14px] border border-[#E5DFD4] bg-white p-3">
            <h2 className="flex items-baseline justify-between text-[13px] font-extrabold text-[#0B2430]">
              공개 전 확인
              <span className={`num text-xs ${unmetCount === 0 ? "text-[#146B7C]" : "text-[#C0392B]"}`}>
                {checklistItems.length - unmetCount} / {checklistItems.length}
              </span>
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {checklistItems.map((item) => (
                <li
                  key={item.itemLabel}
                  className="flex items-start gap-1.5 text-[11.5px] leading-[1.5]"
                >
                  {/* 색만으로 구분하지 않는다 — 기호 + 색 병행(RULE-11) */}
                  <span
                    aria-hidden
                    className={`flex-none font-bold ${item.isDone ? "text-[#146B7C]" : "text-[#C0392B]"}`}
                  >
                    {item.isDone ? "●✓" : "○"}
                  </span>
                  <span className={item.isDone ? "text-[#5C6B72]" : "text-[#8E2D22]"}>
                    {/* 보조기술에는 색·기호 대신 말로 전달한다 */}
                    <span className="sr-only">{item.isDone ? "완료: " : "미완료: "}</span>
                    {item.itemLabel}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-[1.5] text-[#96A1A7]">
              {draft.listingVisibility === "HIDDEN"
                ? "숨김으로는 지금도 저장됩니다. 노출로 바꾸려면 위 항목을 채워주세요."
                : "비어 있는 항목이 있으면 노출 저장이 막힙니다."}
            </p>
          </section>
        </div>
      </div>
    </form>
  );
}
