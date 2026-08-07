# 관리자 A1~A6 착수 전 스키마 일괄 정비 (RULE-12)

작성 2026-08-07 · 상태: **승인됨(전체) — 코드 반영 완료, Phase 1 DDL 실행 대기**

**사용자 결정(2026-08-07):**
1. 전체 승인 — SQL 전달 후 사용자가 실행
2. 진열 순서를 공개 목록 기본 정렬에 반영(진열순서 우선 → 최신순). 가격순·면적순은 사용자가 고른 정렬이므로 미적용
3. 네이버 매물번호: **화면만**(수기 메모 입력 필드) — 자동 조회는 보류. 이에 따라 `naver_listing_no varchar(20)` 컬럼 1개를 원안에 추가

근거: 확정 관리자 기획(`오채영부동산 관리자 기획.dc.html`) + 번들 README 관리자 절 전수 분석(4갈래 분석 → 종합)


## 요약

- properties.status(ACTIVE/COMPLETED/HIDDEN) 단일 축을 listingVisibility(노출/숨김) + dealProgress(거래중/계약중/거래완료) **두 축으로 분해**한다. 확정 기획 A3 카드2가 두 축을 별도 라디오그룹으로 두고("노출 여부와 거래 단계는 이 카드에서만 정합니다"), '계약중'은 현재 codes.ts 어디에도 저장할 자리가 없다.
- A3/A2가 매물마다 요구하는 컬럼 7개를 추가한다: brokerFeeNote(법정 필수 중개보수 문구·현재 src 전체 grep 0건) · displayOrder(진열 순서) · listingCode(관리번호 S-1042) · mapPinMode(동 중심 표시) · priceNegotiable(가격 협의) · archivedAt(보관함) · exposureCheckedAt(노출 90일 연장).
- inquiries·owner_requests의 name/phone NOT NULL을 해제한다 — 이미 **공개된** 개인정보처리방침(src/app/privacy/page.tsx L77·L85)이 "접수일로부터 3개월 후 연락처 자동 파기"를 고지했는데 현재 스키마가 파기를 물리적으로 봉쇄하고 있다. contactPurgedAt으로 파기 이행을 기록한다.
- 신규 테이블은 **2개만** 만든다: inquiry_logs(A4 연락 이력 — 연락처가 파기돼도 남는 분쟁 소명자료)와 property_view_daily(A1 '이번 주 조회' — 이번 목록에서 **유일하게 백필이 불가능**해 지금 시작하지 않으면 데이터가 영영 없다).
- 자동 임시저장(property_drafts)·설정 감사로그(site_setting_logs)·네이버 매물번호는 이번에 넣지 않는다 — 앞의 둘은 README 개발순서 2단계이고 새 테이블이라 나중 추가 비용이 0, 네이버는 RULE-11 크롤링 금지와 정면 충돌한다.
- 삭제(deletedAt·softDeleteProperty)는 컬럼·서비스 함수로 남기되 관리자 UI/뮤테이션은 archivedAt(보관함)으로 대체한다(설계원칙 2 "삭제 기능을 만들지 마십시오").


## 실행 DDL (사용자가 실행)

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- oh4989 관리자 A1~A6 착수 전 스키마 일괄 정비 (RULE-12)
-- Phase 1 = 신규 앱 배포 **전**에 실행해도 기존 앱이 그대로 돈다(status 유지)
-- Phase 2 = 신규 앱 배포가 끝난 뒤 실행
-- Phase 3 = 파괴적 변경, 별도 승인 후 실행 (RULE-5)
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────── Phase 1-A · properties 노출/거래단계 2축 분해 ───────────

-- 두 축 컬럼 추가 — 행마다 값이 달라 기본값으로 채울 수 없으므로 우선 nullable로 만든다
ALTER TABLE properties
  ADD COLUMN listing_visibility varchar(20),
  ADD COLUMN deal_progress varchar(20);

-- status 3값을 2축으로 매핑 백필 — ACTIVE→(노출,거래중) / HIDDEN→(숨김,거래중) / COMPLETED→(노출,거래완료)
-- 근거: HIDDEN은 "작성 중·내려둠"이라 거래단계 정보를 담은 적이 없고(property.service.ts L273이 COMPLETED 이탈 시 completed_at을 NULL로 되돌리므로 HIDDEN 행의 completed_at은 항상 NULL),
--       COMPLETED는 현재 공개 상세·목록(property.ts L315·L425)에 노출 중이므로 VISIBLE로 옮겨야 기존 동작이 보존된다.
--       completed_at 조건은 방어용이며 실제로 걸리는 행은 없다.
UPDATE properties SET
  listing_visibility = CASE WHEN status = 'HIDDEN' THEN 'HIDDEN' ELSE 'VISIBLE' END,
  deal_progress      = CASE WHEN status = 'COMPLETED' OR completed_at IS NOT NULL THEN 'COMPLETED' ELSE 'AVAILABLE' END;

-- 백필이 끝난 뒤에만 NOT NULL·기본값을 확정한다
ALTER TABLE properties
  ALTER COLUMN listing_visibility SET NOT NULL,
  ALTER COLUMN listing_visibility SET DEFAULT 'VISIBLE',
  ALTER COLUMN deal_progress SET NOT NULL,
  ALTER COLUMN deal_progress SET DEFAULT 'AVAILABLE';


-- ─────────── Phase 1-B · properties 신규 컬럼 ───────────

-- 전 행이 같은 값이라 DEFAULT 한 번으로 충족된다(3단계 불필요) — 진열 순서 · 지도 핀 표시 · 가격 협의
ALTER TABLE properties
  ADD COLUMN display_order smallint NOT NULL DEFAULT 0,
  ADD COLUMN map_pin_mode varchar(20) NOT NULL DEFAULT 'EXACT',
  ADD COLUMN price_negotiable boolean NOT NULL DEFAULT false;

-- NULL이 정상 상태인 컬럼 — 중개보수 안내 문구(공개 저장 시에만 필수) · 보관 시각 · 관리번호
ALTER TABLE properties
  ADD COLUMN broker_fee_note varchar(200),
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN listing_code varchar(20),
  ADD COLUMN naver_listing_no varchar(20);

-- 노출 만료(등록 90일) 판정 기준 — DEFAULT now()로 붙이면 기존 3건이 "방금 확인함"이 되므로 등록일로 소급 백필한다
ALTER TABLE properties ADD COLUMN exposure_checked_at timestamptz;
UPDATE properties SET exposure_checked_at = created_at;
ALTER TABLE properties
  ALTER COLUMN exposure_checked_at SET NOT NULL,
  ALTER COLUMN exposure_checked_at SET DEFAULT now();

-- 관리번호는 비어 있을 수 있고, 채워지면 사무소 안에서 유일해야 한다(채번 규칙 확정 전까지는 전부 NULL)
CREATE UNIQUE INDEX properties_listing_code_key ON properties (listing_code) WHERE listing_code IS NOT NULL;


-- ─────────── Phase 1-C · 부분 인덱스 재작성 ───────────

-- 기존 3개는 술어에 status='ACTIVE'를 하드코딩하고 있어 컬럼이 사라지기 전에 먼저 제거해야 한다
DROP INDEX properties_active_geo_idx;
DROP INDEX properties_active_dong_idx;
DROP INDEX properties_active_recent_idx;

-- 공개 조건을 listing_visibility 한 축으로 재작성한다 — deal_progress는 술어에 넣지 않는다
-- 근거: 목록(property.ts L315)은 거래완료도 포함하고 지도(L100)는 거래중만 보므로 술어를 통일해야 세 쿼리가 모두 같은 인덱스를 쓴다.
--       '계약중을 지도에 띄울지'도 미확정이라, 술어에 넣으면 결정이 바뀔 때마다 REINDEX가 된다(매물 수가 수십 건이라 술어 세분화의 이득이 없다).
CREATE INDEX properties_public_geo_idx ON properties (lat, lng)
  WHERE listing_visibility = 'VISIBLE' AND deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX properties_public_dong_idx ON properties (dong)
  WHERE listing_visibility = 'VISIBLE' AND deleted_at IS NULL AND archived_at IS NULL;

-- 목록 커서 페이징 — 진열 순서가 정렬 선두가 되므로 (display_order, created_at DESC)로 교체한다
CREATE INDEX properties_public_order_idx ON properties (display_order, created_at DESC)
  WHERE listing_visibility = 'VISIBLE' AND deleted_at IS NULL AND archived_at IS NULL;


-- ─────────── Phase 1-D · 문의·등록의뢰 연락처 파기 ───────────

-- 연락처만 파기하려면 NULL이 될 수 있어야 한다 — 현재 NOT NULL이라 이미 공개 고지한 3개월 파기가 DB에서 봉쇄돼 있다
ALTER TABLE inquiries
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;

-- 파기 실행 시각 — "파기됨"과 "원래 미기재"를 구분하고 배치에 멱등성을 준다(감독기관 소명 근거)
ALTER TABLE inquiries ADD COLUMN contact_purged_at timestamptz;

-- 접수 경로 — 홈 폼·지도 시트는 둘 다 property_id가 NULL이라 유입 화면을 구분할 수 없다(A4 헤더 '홈 상담 폼')
ALTER TABLE inquiries ADD COLUMN inquiry_source varchar(30);

-- 등록 의뢰도 같은 처리방침(privacy/page.tsx L85)에 3개월 파기를 고지했다 — 문의만 파기하면 반쪽 구현이 굳는다
ALTER TABLE owner_requests
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN contact_purged_at timestamptz;


-- ─────────── Phase 1-E · 신규 테이블 2개 ───────────

-- 문의 연락 이력 타임라인(A4) — 연락처가 파기돼도 "언제 무슨 연락을 했는지"는 남는다. FK restrict = 문의는 지우지 않는다
CREATE TABLE inquiry_logs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  inquiry_id bigint NOT NULL REFERENCES inquiries(id) ON DELETE RESTRICT,
  action varchar(20) NOT NULL,
  memo text,
  admin_user_id bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 문의 상세 타임라인 조회 — (문의, 최신순) 단일 패턴
CREATE INDEX inquiry_logs_inquiry_idx ON inquiry_logs (inquiry_id, created_at DESC);

-- 기존 8건에 접수 이력 1행씩 백필 — 화면에서 '접수' 항목만 createdAt으로 합성하는 분기를 없앤다
INSERT INTO inquiry_logs (inquiry_id, action, created_at)
SELECT id, 'RECEIVED', created_at FROM inquiries;

-- 일자별 조회 집계(A1 '이번 주 조회' KPI + 많이 본 매물 차트) — 누적 view_count로는 기간 분해가 원리적으로 불가능하다
-- ⚠️ 이번 목록에서 유일하게 과거 백필이 불가능한 항목이다. 개인 식별정보 없이 일자별 카운트만 담는다(RULE-11)
CREATE TABLE property_view_daily (
  property_id bigint NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  view_date date NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, view_date)
);


-- ─────────── Phase 1-F · 관리자 계정 ───────────

-- 보조 계정 권한 자리 — README §권한이 "스키마·라우트 가드 자리만 만들어 둡니다"로 지금 넣으라고 명시. 기존 계정은 DEFAULT로 자동 충족
ALTER TABLE admin_users ADD COLUMN admin_role varchar(20) NOT NULL DEFAULT 'OWNER';

-- A3 저장바 '최종 수정 … 오채영' 표시용 — 없으면 로그인 아이디가 화면에 그대로 노출된다
ALTER TABLE admin_users ADD COLUMN display_name varchar(40);


-- ─────────── Phase 1-G · 설정 값 ───────────

-- 문의 연락처 보관 기간 — 파기 배치와 개인정보처리방침 페이지가 같은 값을 봐야 한다(하드코딩 2곳 방지, RULE-11 리스킨)
INSERT INTO site_settings (setting_key, setting_value)
VALUES ('inquiryRetention', '{"months": 3}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════ Phase 2 · 신규 앱 배포가 완료된 뒤에 실행 ═══════════

-- status 제거 — 두 축이 생긴 뒤에도 남겨두면 진실이 두 곳이 된다. 배포 전에 지우면 운영 중인 구버전이 즉시 500
ALTER TABLE properties DROP COLUMN status;


-- ═══════════ Phase 3 · 파괴적 변경, 별도 승인 후 실행 (RULE-5) ═══════════

-- 2026-08-06부터 미사용인 계정 전역 잠금 컬럼 제거 — 잠금은 admin_login_attempts의 (login_id, IP) 단위로 대체됐다
-- schema.ts L324-328 주석이 스스로 "다음 스키마 정리 때 DROP 후보"라고 예고한 항목이며, 이번이 그 정리다
ALTER TABLE admin_users
  DROP COLUMN failed_login_count,
  DROP COLUMN locked_until;
```


## src/db/schema.ts 반영안

## 1) import 교체 (파일 상단 L19~31)

```ts
import type {
  AdminRole,                 // 신규
  BuildingType,
  DealType,
  Direction,
  FloorDisplay,
  InquiryKind,
  InquiryLogAction,          // 신규
  InquirySource,             // 신규
  InquiryStatus,
  MaintenanceDetail,
  MapPinMode,                // 신규
  OwnerRequestStatus,
  PropertyDealProgress,      // 신규 (PropertyStatus 대체)
  PropertyLogAction,
  PropertyOption,
  PropertyVisibility,        // 신규 (PropertyStatus 대체)
} from "@/lib/codes";
```
`PropertyStatus` import는 제거. `uniqueIndex`를 `drizzle-orm/pg-core` import 목록에 추가.

---

## 2) properties — `status` 제거 + 신규 컬럼

**L60~63 `status` 블록을 통째로 아래로 교체:**

```ts
    /* ── 노출 제어 (관리자 A3 카드2) — 두 축을 분리한다 ──
       기존 status varchar 하나(ACTIVE/COMPLETED/HIDDEN)로는 '숨김 + 거래완료',
       '노출 + 계약중' 조합을 표현할 수 없었다. 확정 기획 A3 카드2가 두 축을 별도
       라디오그룹으로 두고 "노출 여부와 거래 단계는 이 카드에서만 정합니다"라고 못박는다.
       특히 '계약중'은 단일 축에 자리가 없어 저장 자체가 불가능했던 값이다. */
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
```

**가격 블록(L69~71) 뒤에 추가:**

```ts
    /** 가격 협의 — 금액 null로 '협의'를 추론하면 공개 요건(금액 필수)과 서로 막힌다.
        플래그가 있어야 checkPublicationRequirements가 "협의면 금액 null 허용"으로 분기할 수 있고,
        금액 0 우회(가격 낮은순 정렬 최상단 점유)를 막는다. */
    priceNegotiable: boolean("price_negotiable").notNull().default(false),
    /** 중개보수 안내 문구 — 법정 필수(A3 카드3). 요율·부가세·실비 조건이 거래·건물유형마다
        달라 site_settings 공통값으로는 표현할 수 없다. 컬럼은 느슨하게(NULL 허용) 두고
        공개 저장 게이트에서만 강제한다 — 작성 중(HIDDEN) 저장을 막지 않기 위함. */
    brokerFeeNote: varchar("broker_fee_note", { length: 200 }),
```
`boolean`을 `drizzle-orm/pg-core` import에 추가.

**주소 블록 끝(L122 `detailAddress` 뒤)에 추가:**

```ts
    /** 관리번호 — A2 표·검색·A4 문의 카드가 표시하는 사람이 부르는 식별자(예: S-1042).
        내부 PK를 화면에 노출하지 않기 위해 별도로 둔다. 채번 규칙(접두 문자·시작번호)이
        확정되기 전까지는 NULL. 채워지면 사무소 안에서 유일하다(부분 UNIQUE). */
    listingCode: varchar("listing_code", { length: 20 }),
```

**좌표 블록(L129~130) 뒤에 추가:**

```ts
    /** 지도 핀 표시 방식 (A3 카드6 토글) — 좌표는 **항상 실제 값**을 저장하고,
        DONG_CENTER일 때만 서버가 공개 응답의 좌표를 동 중심으로 치환한다.
        lat/lng에 동 중심을 직접 써 넣으면 실제 좌표가 영구 소실된다(RULE-11 좌표판 대응). */
    mapPinMode: varchar("map_pin_mode", { length: 20 })
      .$type<MapPinMode>()
      .notNull()
      .default("EXACT"),
```

**메타 블록(L151~160)에 추가:**

```ts
    /** 노출 만료 임박(등록 90일) 판정 기준 (A1 KPI + '연장' 액션).
        updatedAt으로 대체하면 메모 한 줄 수정에도 90일이 리셋되고,
        fieldCheckedAt은 공개면 §8에 노출되는 법정 현장확인일이라 내부 플래그로 겸용하면 안 된다. */
    exposureCheckedAt: timestamp("exposure_checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 보관함 (A2) — deletedAt(soft delete)과 축이 다르다.
        설계원칙 2 "지우지 말고 내릴 것"에 따라 거래완료 30일 뒤 여기로 내린다.
        deletedAt에 겹치면 '보관된 것'과 '사고로 지운 것'을 영영 구분할 수 없다. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
```

**인덱스 배열(L162~178) 교체:**

```ts
  (t) => [
    /* 지도 bounds 검색 — 이 사이트에서 가장 자주 도는 쿼리.
       술어를 listingVisibility 한 축으로 통일한다: 목록은 거래완료도 포함하고 지도는 거래중만
       보는데, dealProgress를 술어에 넣으면 세 쿼리가 서로 다른 인덱스를 요구하게 된다.
       매물이 수십 건 규모라 술어 세분화의 이득이 없다. */
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
    /* 목록형 무한스크롤 커서 페이징 — displayOrder가 정렬 선두 */
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
```

---

## 3) inquiries — 파기 가능하게 완화 + 신규 컬럼

**L240~241 교체:**
```ts
    /* ⚠️ name·phone은 NOT NULL이 아니다 — 접수일 3개월 뒤 **연락처만** 파기하고
       통계·이력은 남기는 것이 이미 공개된 개인정보처리방침의 약속이다(privacy/page.tsx L77).
       NOT NULL이면 파기가 물리적으로 불가능해 '010-****-****' 더미 덮어쓰기밖에 남지 않고,
       그러면 '파기됨'과 '오입력'을 값의 생김새로 추정하게 된다. */
    name: varchar("name", { length: 40 }),
    phone: varchar("phone", { length: 20 }),
```

**L260 `createdIp` 뒤에 추가:**
```ts
    /** 파기 실행 시각 — NULL=미파기. 배치 멱등성 판정과 파기 이행 증빙(개인정보보호법 §21) */
    contactPurgedAt: timestamp("contact_purged_at", { withTimezone: true }),
    /** 접수 경로 (A4 헤더 '홈 상담 폼') — 홈 폼·지도 시트는 둘 다 propertyId가 null이라
        propertyId 유무로는 어느 화면이 문의를 만들었는지 구분할 수 없다. 구형 접수분은 null */
    inquirySource: varchar("inquiry_source", { length: 30 }).$type<InquirySource>(),
```

---

## 4) ownerRequests — 문의와 동일 규칙

**L278~279 교체 + createdIp 뒤 추가:**
```ts
    name: varchar("name", { length: 40 }),
    phone: varchar("phone", { length: 20 }),
    // …
    /** 등록 의뢰도 같은 처리방침(privacy/page.tsx L85)에 3개월 파기를 고지했다 */
    contactPurgedAt: timestamp("contact_purged_at", { withTimezone: true }),
```

---

## 5) adminUsers

```ts
export const adminUsers = pgTable("admin_users", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  loginId: varchar("login_id", { length: 40 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  /** 화면에 표시할 사람 이름 (A3 저장바 '최종 수정 … 오채영').
      없으면 로그인 아이디가 그대로 노출되거나 officeInfo.ownerName을 잘못 끌어다 쓰게 된다
      — 계정 ≠ 개업공인중개사다. */
  displayName: varchar("display_name", { length: 40 }),
  /** 권한 2단계 (README §권한). 지금은 OWNER 1계정 운영이고 ASSISTANT는 라우트 가드 자리만 둔다.
      나중에 넣으면 NOT NULL 추가 + 전 라우터 가드 소급 적용이 한 번에 필요해진다. */
  adminRole: varchar("admin_role", { length: 20 })
    .$type<AdminRole>()
    .notNull()
    .default("OWNER"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt,
});
```
`failedLoginCount` / `lockedUntil` 두 줄과 그 위 ⚠️ 주석 블록은 **Phase 3 DDL 실행 승인 후에** 제거한다 (그 전에 지우면 drizzle 스냅샷과 실DB가 어긋난다).

---

## 6) 신규 테이블 — inquiryLogs

```ts
/* ══════════════════════════ 문의 연락 이력 ══════════════════════════ */

/**
 * A4 연락 이력 타임라인 — 기획 메모: "분쟁이 생겼을 때 '언제 무슨 연락을 했는지'가
 * 남아 있는 편이 안전합니다". inquiries.adminMemo(text) 한 칸으로는 시각·작성자·유형이
 * 있는 이력을 담을 수 없어 '8/6 통화함\n8/8 재통화' 식 누적 우회가 강제된다.
 *
 * ⚠️ 연락처 파기와 한 몸이다 — 자유 텍스트에 전화번호가 재기입되면 3개월 뒤에도
 * 번호가 남아 파기가 형해화된다. 파기 대상을 inquiries.phone 한 컬럼으로 한정하려면
 * memo에 연락처 입력을 UI에서 막거나 파기 시 번호 패턴을 함께 마스킹해야 한다.
 * FK는 restrict — 문의는 삭제하지 않는다(설계원칙 2).
 */
export const inquiryLogs = pgTable(
  "inquiry_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    inquiryId: bigint("inquiry_id", { mode: "number" })
      .notNull()
      .references(() => inquiries.id, { onDelete: "restrict" }),
    // 컬럼명은 property_logs.action 선례를 따른다(RULE-10의 "기존 컬럼명을 따라야 하는" 예외)
    action: varchar("action", { length: 20 }).$type<InquiryLogAction>().notNull(),
    memo: text("memo"),
    adminUserId: bigint("admin_user_id", { mode: "number" }).references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    createdAt,
  },
  (t) => [index("inquiry_logs_inquiry_idx").on(t.inquiryId, t.createdAt.desc())],
);
```

---

## 7) 신규 테이블 — propertyViewDaily

```ts
/* ══════════════════════════ 일자별 조회 집계 ══════════════════════════ */

/**
 * A1 '이번 주 조회' KPI와 '많이 본 매물' 7일 차트의 유일한 근거.
 * properties.viewCount는 **누적 정수 하나**라 기간 분해가 원리적으로 불가능하다
 * (누적값에 '이번 주' 라벨만 다는 것은 거짓 표기다).
 *
 * ⚠️ 이번 정비에서 **유일하게 과거 백필이 불가능한 항목**이다 — 도입 시점부터 쌓인다.
 * 개인 식별정보 없이 (매물, 날짜, 횟수)만 담는다(RULE-11).
 * 기존 누적 viewCount는 A2 표 '조회' 컬럼용으로 그대로 유지한다.
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
```


## src/lib/codes.ts 반영안

## 1) 삭제 — L123~132 `PROPERTY_STATUS` 블록 전체

`PROPERTY_STATUS` / `PropertyStatus` / `PROPERTY_STATUS_LABEL` 3개 심볼을 제거하고 아래로 대체한다.

```ts
/* ─────────────── 매물 노출 / 거래 진행 (관리자 A3 카드2) ───────────────
   기존 PROPERTY_STATUS(ACTIVE·COMPLETED·HIDDEN) 단일 축을 두 축으로 분해했다.
   확정 기획이 '홈페이지 노출'과 '거래 진행 상태'를 별도 라디오그룹으로 두고,
   '계약중'은 단일 축에 자리가 없어 저장 자체가 불가능했던 값이다. */

export const PROPERTY_VISIBILITY = ["VISIBLE", "HIDDEN"] as const;
export type PropertyVisibility = (typeof PROPERTY_VISIBILITY)[number];

export const PROPERTY_VISIBILITY_LABEL: Record<PropertyVisibility, string> = {
  VISIBLE: "노출",
  HIDDEN: "숨김",
};

/** 거래 진행 — AVAILABLE=거래중(기본). ON_SALE으로 하지 않은 이유: 매매 전용처럼 읽힌다 */
export const PROPERTY_DEAL_PROGRESS = ["AVAILABLE", "UNDER_CONTRACT", "COMPLETED"] as const;
export type PropertyDealProgress = (typeof PROPERTY_DEAL_PROGRESS)[number];

export const PROPERTY_DEAL_PROGRESS_LABEL: Record<PropertyDealProgress, string> = {
  AVAILABLE: "거래중",
  UNDER_CONTRACT: "계약중",
  COMPLETED: "거래완료",
};

/** A2 상태 배지 색 (README §A2 확정값) — 공개/비공개는 노출축, 거래완료는 진행축에서 나온다 */
export const PROPERTY_BADGE_TONE = {
  VISIBLE: { color: "#146B7C", tint: "#EDF3F1" },
  HIDDEN: { color: "#7C8990", tint: "#F0ECE4" },
  COMPLETED: { color: "#8A6A12", tint: "#FBF3DF" },
} as const;
```

> **명명 근거(RULE-10):** 핸드오프 README의 원래 필드명은 `visibility` / `dealState`다. `visibility`는 대분류격 단독이고 `dealState`는 기존 `dealType`과 한 글자 차이라 tRPC 응답 JSON에서 혼동된다. 그래서 `listingVisibility` / `dealProgress`로 도메인을 한정했다. 문서 표기를 그대로 따르길 원하면 알려달라.

---

## 2) 추가 — 지도 핀 표시

```ts
/** 지도 핀 표시 방식 (A3 카드6) — DONG_CENTER는 실제 좌표를 보존한 채 응답만 치환한다 */
export const MAP_PIN_MODES = ["EXACT", "DONG_CENTER"] as const;
export type MapPinMode = (typeof MAP_PIN_MODES)[number];

export const MAP_PIN_MODE_LABEL: Record<MapPinMode, string> = {
  EXACT: "지도에 실제 위치 표시",
  DONG_CENTER: "동 중심으로만",
};
```

---

## 3) 수정 — `INQUIRY_STATUS`에 방문 예약 추가 (L141, **DDL 불필요**)

```ts
/* varchar(20) 컬럼이라 값 추가에 마이그레이션이 필요 없다.
   기획 A4 처리 상태 칩 4종(신규/연락중/방문 예약/완료)에 맞춘다.
   SPAM은 기획에 없지만 운영상 필요해 유지한다. */
export const INQUIRY_STATUS = ["NEW", "IN_PROGRESS", "VISIT_BOOKED", "DONE", "SPAM"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUS)[number];

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: "신규",
  IN_PROGRESS: "연락중",   // 기획 탭 문구에 맞춰 '처리중'에서 변경 (라벨만, 데이터 무영향)
  VISIT_BOOKED: "방문 예약",
  DONE: "완료",
  SPAM: "스팸",
};
```

---

## 4) 추가 — 문의 접수 경로 · 연락 이력 액션

```ts
/** 문의 접수 경로 (A4 헤더 세 번째 사실) — 진입점이 4곳이라 propertyId 유무로는 구분되지 않는다 */
export const INQUIRY_SOURCES = [
  "HOME_FORM",
  "PROPERTY_DETAIL",
  "MAP_SHEET",
  "LIST",
  "ETC",
] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  HOME_FORM: "홈 상담 폼",
  PROPERTY_DETAIL: "매물 상세",
  MAP_SHEET: "지도 시트",
  LIST: "매물 목록",
  ETC: "기타",
};

/** 문의 연락 이력 액션 (A4 타임라인) — 분쟁 시 "언제 무슨 연락을 했는지"가 소명자료다 */
export const INQUIRY_LOG_ACTIONS = [
  "RECEIVED",
  "AUTO_REPLY",
  "SMS_SENT",
  "CALL_MEMO",
  "STATUS_CHANGED",
] as const;
export type InquiryLogAction = (typeof INQUIRY_LOG_ACTIONS)[number];

export const INQUIRY_LOG_ACTION_LABEL: Record<InquiryLogAction, string> = {
  RECEIVED: "문의 접수",
  AUTO_REPLY: "자동 회신",
  SMS_SENT: "문자 발송",
  CALL_MEMO: "통화 메모",
  STATUS_CHANGED: "상태 변경",
};
```

---

## 5) 추가 — 관리자 권한

```ts
/** 관리자 권한 (README §권한) — 지금은 OWNER 1계정 운영, ASSISTANT는 라우트 가드 자리만 */
export const ADMIN_ROLES = ["OWNER", "ASSISTANT"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "대표",
  ASSISTANT: "보조",
};
```

---

## 6) 수정 — `PROPERTY_LOG_ACTIONS` 확장 (L169, **DDL 불필요**)

```ts
export const PROPERTY_LOG_ACTIONS = [
  "CREATED",
  "UPDATED",
  /** @deprecated 2축 분해 전 기록. **삭제하지 않는다** — 기존 로그 행이 이 값을 갖고 있다 */
  "STATUS_CHANGED",
  "VISIBILITY_CHANGED",   // 노출/숨김 전환
  "DEAL_PROGRESS_CHANGED", // 거래중/계약중/거래완료 전환
  "ARCHIVED",              // 보관함으로 내림 (A2 일괄 액션 / 거래완료 30일 배치)
  "UNARCHIVED",
  "DELETED",
  "RESTORED",
] as const;
```
`STATUS_CHANGED` 하나로는 "노출을 바꿨나 거래단계를 바꿨나"가 소명자료에서 구분되지 않는다. 다만 **기존 로그 행이 이 값을 그대로 갖고 있으므로 배열에서 빼지 않는다** — 빼면 로그 뷰어가 라벨 조회에 실패한다.


## 마이그레이션 위험·주의

## A. 실행 순서 위험

**A-1. `DROP COLUMN status`는 반드시 신규 앱 배포 이후.** Phase 1만 먼저 돌려도 기존 앱은 status를 계속 읽고 쓰므로 정상 동작한다(두 축은 잠시 유휴). 배포 전에 status를 지우면 운영 중인 구버전이 즉시 500. 반대로 Phase 1과 배포 사이에 관리자가 상태를 바꾸면 두 축이 갱신되지 않으므로, **Phase 1 실행 → 즉시 배포**를 한 세션에서 끝내는 것을 권한다.

**A-2. 부분 인덱스는 컬럼 DROP보다 먼저.** `properties_active_*` 3개가 술어에 `status='ACTIVE'`를 물고 있어, DROP INDEX 없이 DROP COLUMN을 시도하면 실패하거나 인덱스가 함께 사라진다. DDL에 DROP INDEX → CREATE INDEX 순서로 배치했다.

**A-3. `inquiry_logs` 백필 INSERT는 테이블 생성 직후 1회만.** 두 번 돌리면 기존 8건에 접수 이력이 2행씩 생긴다(멱등하지 않다). 앱 배포 후에는 접수 시점에 앱이 RECEIVED 행을 넣으므로 재실행 금지.

---

## B. 컴파일러가 잡아주지 못하는 3곳 (사람이 직접 확인)

**B-1. `property.service.ts` L259 법정 검증 게이트 — 가장 위험.**
현재 게이트는 `if (existing.status === "HIDDEN")`, 즉 **직전 상태**로 판정한다. 2축으로 옮길 때 이 형태를 그대로 복사하면 `dealProgress`만 바꾸는 호출(A2 '거래완료로' 일괄 액션)에서 `existing.listingVisibility`가 이미 VISIBLE이라 검증을 건너뛴다.
→ **판정 기준을 "직전 상태"가 아니라 "전환 결과"로 바꿀 것**: `if (nextVisibility === "VISIBLE") { checkPublicationRequirements(merged) }`. 순수 함수라 멱등하고 비용이 없다. 리뷰에서 critical로 확정됐던 우회 경로(HIDDEN 저장 → 버튼으로 공개)를 분리 후에도 막는 유일하게 안전한 형태다.
→ 검증 입력도 `existing`(DB 행) 그대로가 아니라 **이번 변경을 반영한 병합값**이어야 한다.
→ 회귀 테스트 2건 필수: ① "HIDDEN 저장 → listingVisibility만 VISIBLE로 전환"이 막히는가 ② "VISIBLE 상태에서 dealProgress만 변경"이 검증을 우회하지 않는가.

**B-2. 부분 인덱스 술어와 쿼리 조건 불일치 — 조용히 Seq Scan.**
PostgreSQL 부분 인덱스는 쿼리 조건이 술어를 **함의**해야 쓰인다. 새 술어에 `archived_at IS NULL`을 넣었으므로 공개 쿼리 5곳(`property.ts` L100 mapSearch · L208 homeSummary · L315 list · L425 detail · L488 related)이 **전부** `archivedAt IS NULL`을 함께 걸어야 한다. 빠뜨려도 에러가 나지 않고 결과도 맞아서 발견되지 않는다(EXPLAIN으로만 보인다).

**B-3. `src/app/admin/(authed)/properties/[id]/edit/page.tsx` L18~58.**
`admin.property.detail` 응답을 `Record<string, unknown>`으로 받아 손으로 캐스팅한다(L82 `status: property.status`). **컬럼을 바꿔도 TypeScript가 잡아주지 못하고**, 런타임에 `status: undefined`가 폼에 들어간다. 체크리스트에 반드시 넣을 것 — 구조적으로는 이 캐스팅을 없애고 라우터 출력 타입을 그대로 쓰는 게 맞다.

---

## C. 기존 데이터·이력 파손 지점

**C-1. `property_logs.snapshot`의 옛 키.** `buildLogSnapshot`(property.service.ts L89~98)이 `status`를 담아 왔고, 기존 행은 그 키를 그대로 갖고 있다. jsonb라 마이그레이션은 불필요하지만 **읽는 쪽(A2/A3 이력 화면)이 두 형식을 모두 처리**해야 한다. 신규 스냅샷은 `listingVisibility`/`dealProgress`로.
→ 함께 고칠 것: 스냅샷에 **`description`과 `brokerFeeNote`가 빠져 있다.** 부당광고 문구가 이력에 전혀 남지 않는 상태라 금칙어 분쟁의 소명자료가 되지 못한다.

**C-2. 기존 매물 3건의 `broker_fee_note`는 NULL.** 공개 요건 검사는 저장·상태전환 시점에만 도는 구조(property-schema.ts L124 / property.service.ts L259)이므로 **3건은 NULL인 채 공개 상태를 유지**한다. 하지만 다음에 그 매물을 저장하는 순간 공개 저장이 막힌다. → A2 목록에 "중개보수 문구 누락" 표시를 함께 넣고 실매물 검수 때 채우는 것을 전제한다. (메모리 기록상 이 3건은 [테스트] 매물이라 정리 대상이기도 하다.)

**C-3. `inquiries.phone` NULL 허용 전환.** 기존 8건은 값이 그대로 유지되지만, phone을 non-null로 가정한 코드(`admin-inquiry.ts` 표시, 전화걸기 링크 조립)가 있으면 파기 이후 런타임에서 깨진다. 파기 배치를 붙이기 전에 표시 측을 "파기됨" 분기로 먼저 정리할 것.

**C-4. `display_order` 도입 → T22 복합 커서 재설계.** 공개 목록의 무한스크롤 커서가 현재 `(createdAt, id)` 2키다(`property.ts` L325~334 · L392~403). 정렬 선두가 `display_order`가 되면 3키 커서로 바꿔야 하고, 워크로그 T22의 함정(**tRPC 무한쿼리 `initialCursor` 필수 — 없으면 영구 pending**)과 맞물린다. 커서 변경은 별도 검증을 붙일 것.

---

## D. 기존 코드 파손 지점 (기계적 치환 — TypeScript가 잡아준다)

| 파일 | 지점 |
|---|---|
| `src/domain/property-schema.ts` | L11 import · L60 `status: z.enum` → 2줄 · **L124 `if (value.status === "HIDDEN") return;`** → `value.listingVisibility === "HIDDEN"`. **의미 변화 주의**: 지금은 COMPLETED도 법정 검증을 받는데, 분리 후엔 `HIDDEN+거래완료`가 유예되고 `VISIBLE+거래완료`는 계속 검증받는다 — 기획 의도와 맞는 변화이므로 주석에 명시할 것 |
| `src/domain/publication-requirements.ts` | 로직 수정 **없음**(status를 아예 참조하지 않는 순수 함수). L4~8 주석의 "공개(ACTIVE·COMPLETED)" 표기만 갱신 + `brokerFeeNote` 검사 3줄 추가 |
| `src/server/services/property.service.ts` | L9 import · L48 · L93 · L110 · L151 · L160~166 completedAt 보존 로직 · **L242~283 `updatePropertyStatus` 전체 재설계**(부분 갱신형 `{listingVisibility?, dealProgress?}`로 — A2 일괄 액션이 한쪽만 바꾼다) · L254 no-op 판정 |
| `src/server/trpc/routers/property.ts` | L30(공개 응답에 `listingVisibility`는 실을 필요 없다 — 공개면 매물은 정의상 VISIBLE. `dealProgress`만) · L100 · L208 · L315(`inArray` → `eq(listingVisibility,'VISIBLE')` 한 조건) · L350 · L425 · L488 |
| `src/server/trpc/routers/admin-property.ts` | L7 · L44 select · L52 where에 `isNull(archivedAt)` 추가 · L98~108 `updateStatus` 분해 · **A2용 bulk 뮤테이션 신규 필요**(현재 단건만) |
| `src/app/admin/_components/PropertyForm.tsx` | L37 · L70 · L115 · L166~170 · L238 · L345 · **L436~444 상태 칩을 카드1에서 카드2로 이동**(README: "매물 정보 카드에 상태 칩을 다시 두지 마십시오 — 필드 충돌") · L1039 |
| `src/app/admin/(authed)/properties/page.tsx` | L11~13 · L22~25 · L87 · L118 · L126~146 |
| `src/app/admin/(authed)/page.tsx` | L11 · L22~26 · L63 · L70~88 · L138~161. A1 KPI 4장이 완전히 달라 **재작성에 가깝다** |
| `src/app/properties/ListScreen.tsx` | L42 · L55 `isCompleted`. **계약중 배지 분기 신규**(RULE-11 접근성: 색만으로 구분 금지 — 색 + 텍스트) |
| `src/components/property/PropertyDetailBody.tsx` | L20 · L38 · L90 · L100~105 |
| `src/domain/property-schema.test.ts` | L10 · L110 · L182 fixture 3곳 |
| `src/app/map/**` | status 참조 **0건**(실측 확인) — 마커 응답에 상태가 없다. 계약중을 지도에 띄우기로 하면 `property.ts` L136~152 select에 `dealProgress` 추가 + MapCard 배지 작업이 따라온다 |

---

## E. 착수 전 사용자 결정이 필요한 6건 (추측하지 않고 남김)

1. **'계약중'을 손님 화면에 노출하는가.** 기획 HTML L481은 "목록 카드에 배지로 같이 나갑니다"라고만 하고 어느 목록인지(관리자 A2 / 손님 M2) 특정하지 않는다. 실측: **공개 확정안 HTML에는 '계약중'도 '거래완료'도 등장하지 않는다**(grep 0건). 반면 현 구현은 COMPLETED를 공개 목록·상세에 노출한다.
2. **거래완료를 공개면에 얼마나 오래 두는가.** 거래완료 매물의 계속 광고는 부당 표시·광고 소지가 있다(공인중개사법 §18의2④). `archivedAt` 30일 자동 이동이 **관리자 목록만**의 규칙인지 공개면까지인지. → DDL은 "공개면에서도 제외"를 기본값으로 잡아 인덱스 술어에 `archived_at IS NULL`을 넣었다. 뒤집히면 REINDEX(매물 수가 적어 비용은 없다).
3. **`displayOrder`와 "거래완료는 자동으로 맨 뒤"의 우선순위.** 대표가 거래완료 매물에 -10을 주면 어느 쪽이 이기는가. 정렬식 `ORDER BY (deal_progress='COMPLETED'), display_order, created_at DESC` 의 첫 키를 확정해야 한다.
4. **관리번호 채번 규칙** — S/A/O 접두가 건물유형에서 자동 파생인지 대표 수기 입력인지, 연도별 리셋인지. 확정 전까지는 컬럼만 두고 NULL 유지(DDL은 그렇게 작성했다).
5. **삭제 기능 처리.** 설계원칙 2가 "삭제 기능을 만들지 마십시오"인데 `softDeleteProperty`(service L285) · `softDelete` 뮤테이션(admin-property L110) · 삭제 버튼(properties/page.tsx L39·L158)이 살아 있다. → 권고: 컬럼·서비스 함수는 사고 복구용으로 남기고 **UI와 tRPC 뮤테이션만 제거**, 자리는 보관함이 대체. RULE-5에 따라 실제 제거는 승인 후.
6. **연락처 파기의 범위 2건.** ① 처리방침은 수집 항목에 '이름·연락처'를 적었으나 파기 대상은 '연락처'로만 적었다(privacy L73 vs L77) — 문언대로면 이름이 무기한 보유가 되어 개인정보보호법 §21과 어긋난다. DDL은 `name`도 NULL 가능하게 만들어 두 선택지를 모두 열어 두었다. ② **보유기간 충돌(실제 위반 소지)**: 같은 phone 컬럼에 상담 문의=3개월(L77), 광고성 수신 동의=동의 철회 시까지(L91)로 서로 다른 두 기간을 고지했다. 권고 — 파기 배치는 `marketingConsentAt` 유무와 무관하게 3개월에 파기하고, **처리방침의 광고성 항목 보유기간 문구를 '상담 문의 보유기간 내'로 축소 수정**한다(스키마 변경 아님).

---

## F. 배치 2건의 실행 주체

`거래완료 30일 → 보관함`과 `문의 3개월 → 연락처 파기`가 같은 문제를 공유한다. 서버가 RAM 2GB·PM2 단일 인스턴스이므로 **cron 프로세스를 늘리지 말고 하나의 일일 작업으로 묶을 것**을 권한다. 조회 시점 지연 평가는 파기 이행 시각(`contact_purged_at`)을 남길 수 없어 부적합하다.


## 이번에 넣지 않는 것

이번 변경 묶음에서 **의도적으로 뺀 것**과 그 이유. (원안 후보에는 있었으나 실측 검증 후 제거한 것 포함)

### 1. `property_drafts` 테이블 / `draft_payload`+`draft_saved_at` 컬럼 (자동 임시저장)
README 개발 순서표가 자동 임시저장/백업을 **2단계**로 못박았다(1단계는 A1·A2·A3·A4). 신규 테이블이라 나중에 추가해도 백필 부담이 0이고, 그때가 되면 A6 현장 등록(주소·좌표 없이 저장)까지 요구사항이 확정돼 컬럼 안/테이블 안 중 무엇이 맞는지 실측으로 정할 수 있다.
※ 다만 **A3 구현 시 "30초 자동저장"을 본 행 UPDATE로 만들지 말 것** — 공개 중인 매물을 수정하는 도중 반쯤 고친 금액·주소가 손님 화면에 즉시 나간다(상세가 동적 렌더). 임시저장 기능은 이번 단계에서 만들지 않는 쪽이 안전하다.

### 2. `site_setting_logs` (설정 변경 감사 로그)
A5 사이트 설정은 **2단계** 범위다. 새 테이블이라 나중 추가 비용이 0이고, 지금은 A5 화면이 없어 `officeInfo` 변경이 SQL 수기로만 일어난다. → A5 착수와 함께 넣는다. (README L242 "등록번호·상호 변경 시 감사 로그 필수"는 A5 필수 요건이므로 **잊지 말 것** — A5 계획서에 선행 항목으로 기록 권장.)

### 3. `naver_listing_no` (네이버 부동산 매물번호)
**컬럼보다 기능 자체의 승인이 먼저다.** 기획의 자동 입력(`GET /integrations/naver/listing?no=`)은 CLAUDE.md RULE-11 "외부 플랫폼 매물 크롤링 코드를 작성하지 않는다" 및 SPEC 수정 이력 #3(명율 Puppeteer 스크래핑 배제)과 정면 충돌한다. 컬럼만 미리 만들면 "자리가 있으니 채우자"는 압력이 생긴다. → 대표 확인 후 결정. 공식 오픈 API가 아니면 컬럼도 넣지 않는다.

### 4. `owner_comment` (대표 코멘트 별도 컬럼) — **후보에서 제거**
실측 결과 근거가 없다. A3 카드7에는 textarea가 '매물 특징' 하나뿐이고(기획 HTML L780~790), 우측 레일 미리보기가 **바로 그 문장**을 대표 프로필과 함께 '대표 코멘트'로 렌더한다(L862~865). 레일 체크리스트도 "대표 코멘트 · 부당광고 검사"로 같은 필드를 가리킨다(L1500). 현행 `PropertyDetailBody.tsx` L172~204(OwnerCommentBlock)가 `description`을 그대로 쓰는 구현과 일치한다.
→ 메모리에 남아 있던 "대표코멘트 컬럼 분리" 항목은 **이번 실측 근거로는 불필요**하다. 인덱스에서 내리는 것을 권한다.

### 5. `contact_purge_due_at` (파기 예정일 고정)
보유 기간을 site_settings로 가변화하면 `created_at + N개월` 계산 방식은 N을 늘렸을 때 기존 행의 파기일이 소급 연장돼 위반이 된다 — 논거는 타당하다. 다만 지금은 3개월 **고정**이고, 기간을 실제로 가변화하는 시점(A5, 2단계)에 `created_at + interval '3 months'`로 정확히 백필할 수 있다. 그때까지는 컬럼 없이 계산해도 위반이 발생하지 않는다. → A5에서 함께.

### 6. `marketing_withdrawn_at` (광고 수신 동의 철회)
광고 발송 기능 자체가 없다. 그리고 위 migrationRisks E-6②의 **보유기간 문구 충돌을 먼저 정리해야** 이 컬럼의 의미가 확정된다(3개월에 phone을 파기하면 철회 시각만 남아도 의미가 없다). 순서상 문구 정리 → 발송 기능 → 이 컬럼.

### 7. `updated_by_admin_user_id` / `last_edited_by_admin_user_id` (최종 수정자)
`property_logs`를 `(property_id, created_at DESC)` 인덱스로 최신 1행 조회하면 "누가·언제"가 그대로 나온다(인덱스는 이미 존재). A3는 단건 화면이라 조인 1회 비용이 없고, A2 표에는 수정자 컬럼이 없다. 컬럼을 두면 진실이 두 곳이 된다. → 통계 화면 착수 시 재검토.
※ 이번에 넣은 `admin_users.display_name`이 그 조인 결과를 사람 이름으로 표시하는 자리다.

### 8. `video_title` (유튜브 제목)
공개 상세가 영상 제목을 쓰지 않는다(관리자 표시 전용). `videoDuration`·`videoSummary`·`videoThumbImageId`가 이미 있고, 제목은 A3 화면에서 oEmbed 응답을 그대로 표시하면 된다. → 오프라인·외부 장애 시 빈칸이 문제가 되면 그때 추가.

### 9. `properties.status`에 `REVIEW('검토')` 추가
A1 프로토타입 더미(기획 HTML L1373)에 '검토' 배지가 한 번 등장하지만, A2 배지 색 정의(공개/비공개/거래완료 3종)와 A3 노출 제어 카드(2×3 조합) 어디에도 없다. **프로토타입 더미의 불일치로 보인다.** 필요하다면 값을 늘리는 게 아니라 `listingVisibility='HIDDEN' + dealProgress='AVAILABLE'`로 충분한지 먼저 확인할 것.

### 10. DB CHECK 제약 (거래유형별 금액 필수 등)
넣지 않는다. 기존 설계 판단(schema.ts L65~68 주석)대로 — DB에서 막으면 HIDDEN 작성 중 매물을 저장할 수 없다. 검증은 `publication-requirements.ts` 단일 출처가 계속 맡는다.

---

## 스키마 변경이 아니지만 A1~A6 착수 전에 정리가 필요한 4건

- **레일 체크리스트 8항목 ≠ 현행 법정 검증.** 기획 8항목(HTML L1494~1503)에는 승인일자·주차대수·건축물용도·방향이 **없고**, 반대로 현행 `checkPublicationRequirements`는 이 4개를 강제한다. 기획에만 있고 코드에 없는 것: **사진 3장 이상 + 대표 지정**, 대표 코멘트(description) 비어 있지 않음, **부당광고 금칙어 검사**. 셋 다 컬럼이 아니라 검증 로직 추가로 처리한다(images 배열은 현재 `max(20)`만 있고 `min`이 없다). README가 "레일 배지 개수와 체크리스트 미충족 건수가 항상 일치"를 요구하므로 **두 목록을 `publication-requirements.ts` 한 곳에서 만들어야 한다.**
- **방향(direction) 필수 범위가 기획과 코드에서 다르다.** README §A3 카드1은 "상가·사무실·토지는 방·욕실·방향 입력 없음"이라 하고, `publication-requirements.ts` L41~44 `requiresDirection()`은 "토지만 면제"(고시 근거 주석 있음)로 상가·사무실에도 방향을 강제한다. A3를 기획대로 만들면 **상가 매물이 방향 없이 저장 → 공개 저장이 코드에서 막힌다.** 법령 해석 문제라 스키마가 아니라 어느 쪽을 정본으로 할지 결정이 먼저다. (주력이 상가이므로 실제로 매번 걸린다.)
- **매물명 60자 vs varchar(100)/zod max(100).** README·기획 카운터 모두 `n / 60`. DDL 변경 불필요, zod만 60으로 조이면 된다(넓은 쪽이라 데이터 손실 없음).
- **옵션 21번째 불일치.** 기획은 '풀옵션'(HTML L1474~1476)인데 `codes.ts`는 `LOFT('복층')`. `property_options.option_code`가 varchar(30)이라 **DDL 없이 codes.ts만 조정**하면 되지만, 기존 3건에 `LOFT`가 저장돼 있는지 먼저 확인해야 한다(있으면 값 이관 UPDATE 1줄 필요). 어느 쪽이 정본인지 대표 확인.
- **중개보수 프리셋 3종의 저장 위치.** 매물별 값(`broker_fee_note`)과 프리셋 목록은 별개다. 프리셋은 사무소마다 달라지므로 `site_settings` 키 하나(예: `brokerFeeNotePresets`)가 맞다(RULE-11 하드코딩 금지). DDL 불필요 — A3 구현 시 행 INSERT.
- **금칙어 사전은 컬럼도 site_settings도 아니다.** 부당표시광고 심사지침 기반이라 리스킨해도 값이 같으므로 `src/domain` 상수가 맞다. 검사 **결과**를 보관할 컬럼도 불필요 — 통과한 저장은 그 시점에 통과한 것이고, 저장 시점 원문은 `property_logs.snapshot`(jsonb)에 `description`을 추가하면 남는다(위 migrationRisks C-1).