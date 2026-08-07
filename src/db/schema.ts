import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import type {
  AdminRole,
  BuildingType,
  DealType,
  Direction,
  FloorDisplay,
  InquiryKind,
  InquiryLogAction,
  InquirySource,
  InquiryStatus,
  MaintenanceDetail,
  MapPinMode,
  OwnerRequestStatus,
  PropertyDealProgress,
  PropertyLogAction,
  PropertyOption,
  PropertyVisibility,
} from "@/lib/codes";

/**
 * oh4989 DB 스키마 (PostgreSQL 17).
 *
 * 원본은 SPEC §3이지만 그대로 옮기지 않았다 — 검토하며 고친 지점은 각 위치에 주석으로 남겼다.
 * 코드값은 DB ENUM을 쓰지 않고 varchar + `@/lib/codes`의 `as const`로 관리한다(SPEC §3).
 * `$type<>()`는 런타임 제약이 아니라 타입 수준 표기다 — 값 검증은 zod 입력 스키마가 맡는다.
 */

/** 모든 테이블 공통 생성시각 */
const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

/* ══════════════════════════ 매물 ══════════════════════════ */

export const properties = pgTable(
  "properties",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    title: varchar("title", { length: 100 }).notNull(),
    buildingType: varchar("building_type", { length: 20 })
      .$type<BuildingType>()
      .notNull(),
    dealType: varchar("deal_type", { length: 20 }).$type<DealType>().notNull(),

    /* ── 노출 제어 (관리자 A3 카드2) — 두 축을 분리한다 ──
       기존 status varchar 하나(ACTIVE/COMPLETED/HIDDEN)로는 '숨김+거래완료',
       '노출+계약중' 조합을 표현할 수 없었다. 확정 기획 A3 카드2가 두 축을 별도
       라디오그룹으로 두고 "노출 여부와 거래 단계는 이 카드에서만 정합니다"라고 못박는다. */
    listingVisibility: varchar("listing_visibility", { length: 20 })
      .$type<PropertyVisibility>()
      .notNull()
      .default("VISIBLE"),
    /** 거래 진행 — COMPLETED 진입 시각은 completedAt이 계속 소유한다(과태료 소명 기준시각) */
    dealProgress: varchar("deal_progress", { length: 20 })
      .$type<PropertyDealProgress>()
      .notNull()
      .default("AVAILABLE"),
    /** 진열 순서 — 작을수록 목록 위. 범위 -10~999는 DB가 아니라 zod가 막는다(A3 카드2 스테퍼) */
    displayOrder: smallint("display_order").notNull().default(0),

    /* ── 가격 — 만원 단위 정수 (RULE-11). 부동소수점·문자열 금지 ──
       거래유형별 필수 여부는 DB CHECK로 막지 않는다. SPEC §5가 "법정 필수항목 누락 시
       저장 차단"을 이미 등록 폼의 책임으로 정했고, DB에서 막으면 HIDDEN 상태의
       작성 중 매물을 저장할 수 없게 된다. */
    salePrice: integer("sale_price"),
    deposit: integer("deposit"),
    monthlyRent: integer("monthly_rent"),
    /** 가격 협의 — 금액 null로 '협의'를 추론하면 공개 요건(금액 필수)과 서로 막힌다.
        플래그가 있어야 공개 요건 검사가 "협의면 금액 null 허용"으로 분기할 수 있고,
        금액 0 우회(가격 낮은순 정렬 최상단 점유)를 막는다 (A3 카드3) */
    priceNegotiable: boolean("price_negotiable").notNull().default(false),
    /** 중개보수 안내 문구 — 법정 필수(A3 카드3). 요율·부가세·실비 조건이 거래·건물유형마다
        달라 site_settings 공통값으로 표현할 수 없다. 컬럼은 NULL 허용으로 느슨하게 두고
        공개 저장 게이트에서만 강제한다 — 작성 중(숨김) 저장을 막지 않기 위함 */
    brokerFeeNote: varchar("broker_fee_note", { length: 200 }),

    /* ── 면적 (㎡, 소수1자리) — 법정 표기라 numeric으로 정밀도를 보존한다.
       drizzle에서 numeric은 string으로 읽힌다. 표시 전용이라 그대로 쓰면 되고,
       계산이 필요하면 도메인 레이어에서 변환한다. */
    exclusiveArea: numeric("exclusive_area", {
      precision: 7,
      scale: 1,
    }).notNull(),
    supplyArea: numeric("supply_area", { precision: 7, scale: 1 }),

    /* ── 층 — 건물유형별 표기 분기는 codes.ts의 FLOOR_RULE_BY_BUILDING_TYPE ── */
    floor: smallint("floor"), // 단독주택은 null
    totalFloor: smallint("total_floor").notNull(),
    floorDisplay: varchar("floor_display", { length: 20 })
      .$type<FloorDisplay>()
      .notNull()
      .default("EXACT"),

    /* ── 법정 명시항목 (디자인가이드 §8) ── */
    roomCount: smallint("room_count"), // SPEC의 tinyint → PostgreSQL엔 없어 smallint
    bathCount: smallint("bath_count"),
    direction: varchar("direction", { length: 4 }).$type<Direction>(),
    directionBase: varchar("direction_base", { length: 20 }), // '안방'·'거실' 등 기준
    moveInDate: varchar("move_in_date", { length: 20 }), // '즉시입주' 또는 날짜 문자열
    approvalDate: date("approval_date"), // 행정기관 승인일자
    parkingTotal: smallint("parking_total"),
    parkingPerUnit: numeric("parking_per_unit", { precision: 3, scale: 1 }),
    buildingUse: varchar("building_use", { length: 50 }), // 건축물 용도

    /* ── 관리비 — 일반/사용료/기타 3구분 의무 ── */
    maintenanceFee: integer("maintenance_fee"), // 총액(만원)
    maintenanceDetail: jsonb("maintenance_detail").$type<MaintenanceDetail>(),

    /* ── 상가·사무실 전용 (2026-08-06 추가 — 네이버부동산 실측 참고문서 §5)
       주력이 상가인데 권리금·업종 자리가 없으면 description에 섞여 들어가
       나중에 분리하려면 텍스트 파싱 마이그레이션이 필요해진다(RULE-12).
       권리금: 0 = "없음" 표기(정보), null = 미기재. 주거형은 항상 null */
    premiumFee: integer("premium_fee"), // 권리금(만원)
    businessTypeCurrent: varchar("business_type_current", { length: 30 }), // 현재업종 (예: 공실)
    businessTypeRecommended: varchar("business_type_recommended", { length: 60 }), // 추천업종

    /* ── 주소 ── */
    sido: varchar("sido", { length: 20 }).notNull(),
    sigungu: varchar("sigungu", { length: 30 }).notNull(),
    dong: varchar("dong", { length: 30 }).notNull(),
    // SPEC의 char(10) → varchar. char는 공백 패딩이 붙어 비교·조인에서 사고가 난다
    bjdCode: varchar("bjd_code", { length: 10 }).notNull(), // 법정동코드
    jibunAddress: varchar("jibun_address", { length: 200 }).notNull(),
    roadAddress: varchar("road_address", { length: 200 }),
    /** ⚠️ 비공개 — 공개 tRPC 응답에서 항상 제거한다 (RULE-11, SPEC §3) */
    detailAddress: varchar("detail_address", { length: 100 }),
    /** 관리번호 — A2 표·검색·A4 문의 카드가 표시하는 사람이 부르는 식별자(예: S-1042).
        내부 PK를 화면에 노출하지 않기 위해 별도로 둔다. 채번 규칙 확정 전까지 NULL,
        채워지면 사무소 안에서 유일하다(부분 UNIQUE) */
    listingCode: varchar("listing_code", { length: 20 }),
    /** 네이버 부동산 매물번호 — **수기 메모용**(사용자 결정 2026-08-07: 화면만, 자동 조회는 보류).
        자동 입력 기능은 크롤링 금지 원칙(RULE-11)과 충돌해 대표 확인 전까지 만들지 않는다 */
    naverListingNo: varchar("naver_listing_no", { length: 20 }),

    /* ── 좌표 ──
       SPEC은 decimal(10,7)이지만 double precision으로 바꿨다. 이 사이트의 핵심 쿼리가
       bounds 검색(lat/lng BETWEEN)이고 마커마다 좌표를 숫자로 쓰는데, numeric은
       drizzle에서 string으로 읽혀 마커 하나하나 parseFloat를 돌게 된다.
       좌표는 금액과 달리 10진 정확도가 필요 없다(double은 소수 15자리 ≈ 1cm 미만 오차). */
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** 지도 핀 표시 방식 (A3 카드6 토글) — 좌표는 **항상 실제 값**을 저장하고,
        DONG_CENTER일 때만 서버가 공개 응답의 좌표를 동 중심으로 치환한다.
        lat/lng에 동 중심을 직접 써 넣으면 실제 좌표가 영구 소실된다 */
    mapPinMode: varchar("map_pin_mode", { length: 20 })
      .$type<MapPinMode>()
      .notNull()
      .default("EXACT"),

    /* ── 콘텐츠 ── */
    description: text("description").notNull().default(""), // 매물 특징
    videoUrl: varchar("video_url", { length: 300 }), // YouTube 일부공개 URL
    videoDuration: varchar("video_duration", { length: 10 }), // '0:48'
    /** 영상 아래 병기하는 자막 요약 (디자인가이드 §5-7).
        음소거 시청자와 검색엔진 양쪽 대응용이라 필수인데 SPEC §3에 자리가 없었다. */
    videoSummary: varchar("video_summary", { length: 100 }),
    /** 영상 썸네일로 쓸 사진 — "첫 프레임 자동 추출이 아니라 관리자가 지정"(§5-7).
        별도 저장소를 만들지 않고 이미 올린 매물 사진 중 하나를 가리킨다.
        properties ↔ property_images 순환 참조지만, FK는 CREATE TABLE이 모두 끝난 뒤
        ALTER로 붙으므로 문제되지 않는다. 사진이 지워지면 썸네일 지정만 해제된다. */
    videoThumbImageId: bigint("video_thumb_image_id", {
      mode: "number",
    }).references((): AnyPgColumn => propertyImages.id, {
      onDelete: "set null",
    }),
    fieldCheckedAt: date("field_checked_at"), // 현장 확인일 배지 (§8)

    /* ── 메타 ── */
    viewCount: integer("view_count").notNull().default(0),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** 노출 만료 임박(등록 90일) 판정 기준 (A1 KPI + '연장' 액션).
        updatedAt으로 대체하면 메모 한 줄 수정에도 90일이 리셋되고, fieldCheckedAt은
        공개면 §8에 노출되는 법정 현장확인일이라 내부 플래그로 겸용하면 안 된다 */
    exposureCheckedAt: timestamp("exposure_checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 거래완료 시각 — 설정 시 지도·목록·상세를 즉시 revalidate 한다 (RULE-11) */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** 보관함 (A2) — deletedAt(soft delete)과 축이 다르다.
        설계원칙 2 "지우지 말고 내릴 것"에 따라 거래완료 30일 뒤 여기로 내린다.
        deletedAt에 겹치면 '보관된 것'과 '사고로 지운 것'을 영영 구분할 수 없다 */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** soft delete. 공개 조회는 전부 `deleted_at IS NULL`을 함께 본다 */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    /* 지도 bounds 검색 — 이 사이트에서 가장 자주 도는 쿼리.
       술어를 listingVisibility 한 축으로 통일한다: 목록은 거래완료도 포함하고 지도는
       완료 제외로 보는데, dealProgress를 술어에 넣으면 쿼리마다 다른 인덱스를 요구하게 된다.
       매물이 수십 건 규모라 술어 세분화의 이득이 없다.
       ⚠️ 공개 쿼리는 반드시 archivedAt IS NULL을 함께 걸어야 이 인덱스를 탄다. */
    index("properties_public_geo_idx")
      .on(t.lat, t.lng)
      .where(
        sql`${t.listingVisibility} = 'VISIBLE' AND ${t.deletedAt} IS NULL AND ${t.archivedAt} IS NULL`,
      ),
    /* 줌아웃 시 동별 집계 (SPEC §4 mapSearch) */
    index("properties_public_dong_idx")
      .on(t.dong)
      .where(
        sql`${t.listingVisibility} = 'VISIBLE' AND ${t.deletedAt} IS NULL AND ${t.archivedAt} IS NULL`,
      ),
    /* 목록형 무한스크롤 커서 페이징 — 진열 순서(displayOrder)가 정렬 선두 */
    index("properties_public_order_idx")
      .on(t.displayOrder, t.createdAt.desc())
      .where(
        sql`${t.listingVisibility} = 'VISIBLE' AND ${t.deletedAt} IS NULL AND ${t.archivedAt} IS NULL`,
      ),
    /* 목록 필터 (거래유형·건물유형) */
    index("properties_type_idx").on(t.dealType, t.buildingType),
    /* 관리번호는 비어 있을 수 있고, 채워지면 유일하다 */
    uniqueIndex("properties_listing_code_key")
      .on(t.listingCode)
      .where(sql`${t.listingCode} IS NOT NULL`),
  ],
);

/* ══════════════════════════ 매물 사진 ══════════════════════════ */

/**
 * SPEC §3에 있던 `isMain`을 뺐다.
 * `sortOrder`와 `isMain`이 함께 있으면 "대표 사진"의 진실이 두 곳이 되어
 * isMain=true인데 sortOrder=3인 상태가 만들어질 수 있다.
 * **sortOrder=0이 대표 사진**으로 통일한다(명율도 같은 방식).
 *
 * filePath/thumbPath 2종은 브라우저 Canvas에서 만들어 올린다(SPEC 수정 이력 #2).
 */
export const propertyImages = pgTable(
  "property_images",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    propertyId: bigint("property_id", { mode: "number" })
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    filePath: varchar("file_path", { length: 300 }).notNull(), // 상세용
    thumbPath: varchar("thumb_path", { length: 300 }).notNull(), // 목록·마커용
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt,
  },
  (t) => [index("property_images_property_idx").on(t.propertyId, t.sortOrder)],
);

/* ══════════════════════════ 매물 옵션 ══════════════════════════ */

/**
 * SPEC §3에는 PK가 없었다. 그대로 두면 같은 옵션이 여러 번 들어가
 * 상세 화면에 "에어컨"이 두 번 뜬다. (propertyId, optionCode) 복합 PK로 막는다.
 */
export const propertyOptions = pgTable(
  "property_options",
  {
    propertyId: bigint("property_id", { mode: "number" })
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    optionCode: varchar("option_code", { length: 30 })
      .$type<PropertyOption>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.optionCode] })],
);

/* ══════════════════════════ 문의 ══════════════════════════ */

export const inquiries = pgTable(
  "inquiries",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    /** 매물이 하드 삭제돼도 문의 자체는 남는다 */
    propertyId: bigint("property_id", { mode: "number" }).references(
      () => properties.id,
      { onDelete: "set null" },
    ),
    /* ⚠️ name·phone은 NOT NULL이 아니다 — 접수일 3개월 뒤 **연락처만** 파기하고
       통계·이력은 남기는 것이 이미 공개된 개인정보처리방침의 약속이다(/privacy §2).
       NOT NULL이면 파기가 물리적으로 불가능하다 */
    name: varchar("name", { length: 40 }),
    phone: varchar("phone", { length: 20 }),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 })
      .$type<InquiryStatus>()
      .notNull()
      .default("NEW"),
    adminMemo: text("admin_memo"),
    /** 파기 실행 시각 — null=미파기. 배치 멱등성 판정과 파기 이행 증빙(개인정보보호법 §21) */
    contactPurgedAt: timestamp("contact_purged_at", { withTimezone: true }),
    /** 접수 경로 (A4 헤더) — 홈 폼·지도 시트는 둘 다 propertyId가 null이라 유무로 구분 불가 */
    inquirySource: varchar("inquiry_source", { length: 30 }).$type<InquirySource>(),
    /** 문의 유형 (확정안 M5 칩: 매물 찾기/내놓기/기타) — 구형 접수분은 null(미기재) */
    inquiryKind: varchar("inquiry_kind", { length: 20 }).$type<InquiryKind>(),
    /** 관심 지역·매물 유형 (확정안 M5 선택 입력) */
    interestDong: varchar("interest_dong", { length: 30 }),
    interestBuildingType: varchar("interest_building_type", { length: 20 }).$type<BuildingType>(),
    /** 개인정보 수집 동의 시각 — 폼의 동의 체크(디자인가이드 §5-8)에 대응하는 증빙 */
    privacyConsentAt: timestamp("privacy_consent_at", {
      withTimezone: true,
    }).notNull(),
    /** [선택] 광고성 정보 수신 동의 시각 — null=미동의. 확정안 M5 동의 2종 분리의 증빙 */
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    /** 레이트리밋(IP당 시간당 5회, SPEC §4) 판정과 스팸 선별용 */
    createdIp: varchar("created_ip", { length: 45 }),
    createdAt,
  },
  (t) => [
    index("inquiries_status_recent_idx").on(t.status, t.createdAt.desc()),
    /** 레이트리밋 조회 — 최근 1시간 같은 IP 건수 */
    index("inquiries_ip_recent_idx").on(t.createdIp, t.createdAt.desc()),
  ],
);

/* ══════════════════════════ 매물 등록 의뢰 (집주인용) ══════════════════════════ */

export const ownerRequests = pgTable(
  "owner_requests",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    /* 문의와 동일 규칙 — 등록 의뢰도 같은 처리방침에 3개월 파기를 고지했다 */
    name: varchar("name", { length: 40 }),
    phone: varchar("phone", { length: 20 }),
    addressHint: varchar("address_hint", { length: 200 }),
    dealType: varchar("deal_type", { length: 20 }).$type<DealType>(),
    message: text("message"),
    status: varchar("status", { length: 20 })
      .$type<OwnerRequestStatus>()
      .notNull()
      .default("NEW"),
    adminMemo: text("admin_memo"),
    privacyConsentAt: timestamp("privacy_consent_at", {
      withTimezone: true,
    }).notNull(),
    /** 파기 실행 시각 — 문의와 동일(개인정보보호법 §21) */
    contactPurgedAt: timestamp("contact_purged_at", { withTimezone: true }),
    createdIp: varchar("created_ip", { length: 45 }),
    createdAt,
  },
  (t) => [index("owner_requests_status_recent_idx").on(t.status, t.createdAt.desc())],
);

/* ══════════════════════════ 문의 연락 이력 ══════════════════════════ */

/**
 * A4 연락 이력 타임라인 — 분쟁 시 "언제 무슨 연락을 했는지"가 소명자료다.
 * adminMemo(text) 한 칸으로는 시각·작성자·유형이 있는 이력을 담을 수 없다.
 * ⚠️ 연락처 파기와 한 몸: memo 자유 텍스트에 전화번호가 재기입되면 3개월 뒤에도 번호가
 * 남아 파기가 형해화된다 — A4 화면에서 memo에 연락처 입력을 막는 안내를 붙일 것.
 * FK restrict — 문의는 삭제하지 않는다(설계원칙 2).
 */
export const inquiryLogs = pgTable(
  "inquiry_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    inquiryId: bigint("inquiry_id", { mode: "number" })
      .notNull()
      .references(() => inquiries.id, { onDelete: "restrict" }),
    // 컬럼명은 property_logs.action 선례를 따른다(RULE-10의 "기존 컬럼명" 예외)
    action: varchar("action", { length: 20 }).$type<InquiryLogAction>().notNull(),
    memo: text("memo"),
    adminUserId: bigint("admin_user_id", { mode: "number" }).references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt,
  },
  (t) => [index("inquiry_logs_inquiry_idx").on(t.inquiryId, t.createdAt.desc())],
);

/* ══════════════════════════ 일자별 조회 집계 ══════════════════════════ */

/**
 * A1 '이번 주 조회' KPI와 '많이 본 매물' 7일 차트의 유일한 근거 —
 * properties.viewCount는 누적 정수 하나라 기간 분해가 원리적으로 불가능하다.
 * ⚠️ 이번 정비에서 유일하게 과거 백필이 불가능한 항목 — 도입 시점부터 쌓인다.
 * 개인 식별정보 없이 (매물, 날짜, 횟수)만 담는다(RULE-11).
 */
export const propertyViewDaily = pgTable(
  "property_view_daily",
  {
    propertyId: bigint("property_id", { mode: "number" })
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    viewDate: date("view_date").notNull(),
    viewCount: integer("view_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.viewDate] })],
);

/* ══════════════════════════ 사이트 설정 ══════════════════════════ */

/**
 * 사무소 법정정보·초기 지도 좌표·정책 문구 등. 리스킨의 교체 지점이다 (RULE-11).
 * SPEC의 컬럼명 `key`/`value`는 대분류격 단독 이름이라(RULE-10) 구체화했다.
 * ⚠️ PG·API 시크릿은 여기에 넣지 않는다 — 서버 env 원칙 (RULE-11).
 */
export const siteSettings = pgTable("site_settings", {
  settingKey: varchar("setting_key", { length: 60 }).primaryKey(),
  settingValue: jsonb("setting_value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ══════════════════════════ 관리자 ══════════════════════════ */

/**
 * 1~2계정. `/admin`은 공개 경로이므로 브루트포스에 그대로 노출된다 —
 * SPEC §3에 없던 실패 횟수·잠금 컬럼을 지금 넣는다(운영 데이터가 쌓이면 추가 비용이 커진다).
 */
export const adminUsers = pgTable("admin_users", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  loginId: varchar("login_id", { length: 40 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(), // bcrypt
  /** 화면에 표시할 사람 이름 (A3 저장바 '최종 수정 … 오채영') — 계정 ≠ 개업공인중개사다 */
  displayName: varchar("display_name", { length: 40 }),
  /** 권한 2단계 (README §권한) — 지금은 OWNER 1계정, ASSISTANT는 라우트 가드 자리만 */
  adminRole: varchar("admin_role", { length: 20 }).$type<AdminRole>().notNull().default("OWNER"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /* failedLoginCount·lockedUntil은 Phase 3 DDL(2026-08-07)로 DB에서 제거됐다 —
     잠금은 admin_login_attempts의 (loginId, IP) 단위가 담당한다.
     ⚠️ 여기 정의를 남겨두면 Drizzle이 없는 컬럼을 select해 로그인이 통째로 500이 된다(실측). */
  createdAt,
});

/**
 * 관리자 로그인 실패 기록 — 잠금 판정의 단위를 (loginId, IP)로 좁힌다.
 * 계정 전역 잠금이면 공격자가 오답 5회로 실제 관리자까지 차단(DoS)할 수 있다.
 * 같은 IP에서만 차단되면 관리자는 자기 IP에서 정상 로그인이 가능하다.
 * 행은 로그인 성공 시(해당 조합) 삭제하고, 오래된 행은 판정 쿼리가 시간창으로 거른다.
 */
export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    loginId: varchar("login_id", { length: 40 }).notNull(), // 존재하지 않는 계정 시도도 기록한다
    clientIp: varchar("client_ip", { length: 45 }),
    createdAt,
  },
  (t) => [index("admin_login_attempts_lookup_idx").on(t.loginId, t.clientIp, t.createdAt.desc())],
);

/* ══════════════════════════ 매물 변경 이력 ══════════════════════════ */

/**
 * 거래완료 방치 과태료의 **소명자료**다 (RULE-11).
 * SPEC §3에 없던 `adminUserId`를 넣었다 — "언제 바뀌었나"만 있고 "누가"가 없으면
 * 소명자료로서 약하다. 매물이 하드 삭제되면 이력이 의미를 잃으므로 FK를 restrict로 두고,
 * 삭제는 `properties.deleted_at`(soft delete)으로만 한다.
 */
export const propertyLogs = pgTable(
  "property_logs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    propertyId: bigint("property_id", { mode: "number" })
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 20 })
      .$type<PropertyLogAction>()
      .notNull(),
    adminUserId: bigint("admin_user_id", { mode: "number" }).references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    snapshot: jsonb("snapshot"),
    createdAt,
  },
  (t) => [
    index("property_logs_property_idx").on(t.propertyId, t.createdAt.desc()),
  ],
);
