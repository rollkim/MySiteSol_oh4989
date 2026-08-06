import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
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
  varchar,
} from "drizzle-orm/pg-core";

import type {
  BuildingType,
  DealType,
  Direction,
  FloorDisplay,
  InquiryStatus,
  MaintenanceDetail,
  OwnerRequestStatus,
  PropertyLogAction,
  PropertyOption,
  PropertyStatus,
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
    status: varchar("status", { length: 20 })
      .$type<PropertyStatus>()
      .notNull()
      .default("ACTIVE"),

    /* ── 가격 — 만원 단위 정수 (RULE-11). 부동소수점·문자열 금지 ──
       거래유형별 필수 여부는 DB CHECK로 막지 않는다. SPEC §5가 "법정 필수항목 누락 시
       저장 차단"을 이미 등록 폼의 책임으로 정했고, DB에서 막으면 HIDDEN 상태의
       작성 중 매물을 저장할 수 없게 된다. */
    salePrice: integer("sale_price"),
    deposit: integer("deposit"),
    monthlyRent: integer("monthly_rent"),

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

    /* ── 좌표 ──
       SPEC은 decimal(10,7)이지만 double precision으로 바꿨다. 이 사이트의 핵심 쿼리가
       bounds 검색(lat/lng BETWEEN)이고 마커마다 좌표를 숫자로 쓰는데, numeric은
       drizzle에서 string으로 읽혀 마커 하나하나 parseFloat를 돌게 된다.
       좌표는 금액과 달리 10진 정확도가 필요 없다(double은 소수 15자리 ≈ 1cm 미만 오차). */
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),

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
    /** 거래완료 시각 — 설정 시 지도·목록·상세를 즉시 revalidate 한다 (RULE-11) */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** soft delete. 공개 조회는 전부 `deleted_at IS NULL`을 함께 본다 */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    /* 지도 bounds 검색 — 이 사이트에서 가장 자주 도는 쿼리.
       공개면은 항상 ACTIVE + 미삭제만 보므로 부분 인덱스로 크기를 줄인다. */
    index("properties_active_geo_idx")
      .on(t.lat, t.lng)
      .where(sql`${t.status} = 'ACTIVE' AND ${t.deletedAt} IS NULL`),
    /* 줌아웃 시 동별 집계 (SPEC §4 mapSearch) */
    index("properties_active_dong_idx")
      .on(t.dong)
      .where(sql`${t.status} = 'ACTIVE' AND ${t.deletedAt} IS NULL`),
    /* 목록형 무한스크롤 커서 페이징 */
    index("properties_active_recent_idx")
      .on(t.createdAt.desc())
      .where(sql`${t.status} = 'ACTIVE' AND ${t.deletedAt} IS NULL`),
    /* 목록 필터 (거래유형·건물유형) */
    index("properties_type_idx").on(t.dealType, t.buildingType),
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
    name: varchar("name", { length: 40 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 })
      .$type<InquiryStatus>()
      .notNull()
      .default("NEW"),
    adminMemo: text("admin_memo"),
    /** 개인정보 수집 동의 시각 — 폼의 동의 체크(디자인가이드 §5-8)에 대응하는 증빙 */
    privacyConsentAt: timestamp("privacy_consent_at", {
      withTimezone: true,
    }).notNull(),
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
    name: varchar("name", { length: 40 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
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
    createdIp: varchar("created_ip", { length: 45 }),
    createdAt,
  },
  (t) => [index("owner_requests_status_recent_idx").on(t.status, t.createdAt.desc())],
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
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedLoginCount: smallint("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt,
});

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
