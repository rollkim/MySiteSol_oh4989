---
date: 2026-08-06
project: oh4989
type: 계획
status: 완료 — T1~T13 전체 + T14(관리자 UI 개편, 세션 중 추가) 실측 검증·배포까지 완료 (2026-08-06 오후). 실매물 검수(13-7)만 사용자 진행 대기. 상세는 작업로그 참조
---

# oh4989 Phase 1 구현 계획 (실행 문서)

> **For agentic workers:** 이 계획은 태스크 단위로 순서대로 실행한다. 체크박스(`- [ ]`)로 진행을 추적한다.
> 실행 전 필독: `C:\_Hope\Ohsite\oh4989\CLAUDE.md` → `계획_Phase1(oh4989-phase1)_20260806.md`(인수인계) → 이 문서.
> ⚠️ RULE-2(DB 접속 금지)·RULE-7(git 금지)이 모든 태스크에 적용된다. 커밋 스텝은 없다.

**Goal:** 관리자가 로그인해 매물 1건(사진 포함)을 등록하면, `https://oh4989.com/properties/[id]` 공개 상세 페이지가 법정 표기(§8)를 갖추고 뜬다.

**Architecture:** 기존 tRPC 2계층(public/admin) 골격 위에 ① jose 서명 쿠키 세션으로 `ctx.adminUserId`를 채우고 ② 순수 도메인 함수(`src/domain`)에 가격·층 표기·검증 규칙을 격리하고 ③ 서비스 레이어가 트랜잭션+`property_logs`를 소유하며 ④ 이미지는 브라우저 Canvas 2종 생성→라우트 핸들러 저장(경로 이탈 방어)로 처리한다. UI는 관리자(로그인·목록·폼)와 공개 상세 1장.

**Tech Stack:** 기존 스택 + 신규 `jose`(세션) · `bcryptjs`(해시) · `vitest`(도메인 단위 테스트). UI 라이브러리 추가 없음(Tailwind 4만).

---

## 0. 사전 결정 — 인수인계 문서의 "열려 있는 판단" 확정안

| 판단 | 결정 | 근거 |
|---|---|---|
| 세션 방식 | **jose HS256 서명 쿠키** (PaRaSOL `admin-session.ts` 이식). 쿠키 `oh4989_admin`, aud `admin`, 수명 8시간. DB 세션 테이블 없음 | 관리자 1~2계정에 상태 저장 세션의 이점(강제 로그아웃)이 없고 스키마 추가를 피한다. env 키는 `.env.example`에 이미 있는 `SESSION_SECRET` |
| adminProcedure의 DB 재확인 | **하지 않는다** — JWT 판독만 | PaRaSOL이 매 요청 재확인하는 이유는 "계정 비활성화" 기능 때문. oh4989에 그 기능이 없다(잠금은 로그인 시에만 판정). 단순함 우선 |
| 업로드 경로 | `{UPLOAD_DIR}/properties/{yyyymm}/{hex24}.jpg` + `{hex24}-thumb.jpg`. 개발 기본값은 프로젝트 **옆** `C:\_Hope\Ohsite\oh4989-uploads` | PaRaSOL 검증 패턴. 파일명 재생성으로 경로 이탈·덮어쓰기 원천 차단. 운영 nginx `/uploads/` alias와 일치 |
| 이미지 2종 해상도 | 상세 **장변 1600px q0.85** / 썸네일 **장변 480px q0.8**, 크롭 없이 비율 유지, **출력은 전부 JPEG** | 상세: PC 2단 폭 ~800px×레티나2. 썸네일: 목록 카드 ~200px×2~3. PNG 유지를 버리는 이유 — 매물 사진에 투명도가 무의미하고, 전 파일 Canvas 재인코딩이 EXIF GPS 제거(RULE-11)를 형식과 무관하게 보장 |
| 관리자 UI | 라이브러리 추가 없음. Tailwind + 디자인 토큰 소폭 | 리스킨 대상은 공개면이지 `/admin`이 아니다. 의존성 최소 |
| 명율 가격 파서 | **Phase 1에서 만들지 않는다** | 사용처가 자동등록(Phase 4)뿐. 폼은 숫자 입력이라 파서가 필요 없다 (YAGNI) |
| 공개 상세 렌더 | **동적 SSR** (ISR 아님) | SPEC은 ISR+revalidate지만 Phase 1은 viewCount 증가로 어차피 매 요청 DB를 만진다. 동적이면 "COMPLETED 즉시 반영"(RULE-11)이 자연 충족. ISR 전환은 Phase 4 SEO 작업과 함께 |
| 좌표·주소 입력 | Phase 1은 **수동 입력** (lat/lng 숫자, 법정동코드 직접 기입) | 카카오 앱 키 미확보(Phase 2 블로커). 폼에 "카카오맵 우클릭→좌표 복사" 안내 문구 |

### 로그인 잠금 정책 (admin_users 기존 컬럼 사용)

- 실패 시 `failedLoginCount` +1. **5회** 도달 → `lockedUntil = now + 15분`, 카운트 0으로 리셋
- 잠금 중 로그인 시도는 비밀번호 비교 없이 거부
- 성공 시 카운트·잠금 해제 + `lastLoginAt` 갱신
- 실패 사유는 "아이디 없음"과 "비밀번호 불일치"를 **구분하지 않고** 같은 메시지로

---

## 1. 파일 구조 맵 (신규 = ✚, 수정 = ✎)

```
src/domain/                                ✚ 도메인 레이어 (RULE-14) — 순수 함수, React·DB 임포트 금지
  price.ts / price.test.ts                 만원 정수 → "4억 3,000" · "500/45"
  floor.ts / floor.test.ts                 §8 층 표기 3분기 + 저/중/고 밴드
  area.ts / area.test.ts                   "84.9㎡ (25.7평)" 병기
  property-schema.ts / property-schema.test.ts   zod 입력 스키마 — 폼·라우터 공유. 법정 필수 검증
src/server/auth/
  admin-session.ts                         ✚ jose 발급·판독·삭제
src/server/services/
  admin-auth.service.ts                    ✚ bcrypt 검증 + 실패 잠금
  image-storage.service.ts                 ✚ 2종 저장·경로 이탈 방어·삭제
  property.service.ts                      ✚ CRUD 트랜잭션 + property_logs
  site-settings.service.ts                 ✚ officeInfo 조회
src/server/trpc/
  context.ts                               ✎ adminUserId를 세션에서 채움
  caller.ts                                ✚ 서버 컴포넌트용 caller (HTTP 왕복 없이 라우터 호출)
  routers/_app.ts                          ✎ property + admin.{auth,property} 등록
  routers/property.ts                      ✚ public detail/related — detailAddress 제거
  routers/admin-auth.ts                    ✚ login/logout/getSession
  routers/admin-property.ts                ✚ create/update/updateStatus/softDelete/list/detail
src/lib/
  image-resize.ts                          ✚ 클라 Canvas 2종 생성 (EXIF 소멸 지점)
src/app/
  uploads/[...storagePath]/route.ts        ✚ 개발용 사진 서빙 (운영은 nginx가 선점)
  api/admin/property-images/route.ts       ✚ 업로드 핸들러 (multipart라 tRPC 밖)
  admin/layout.tsx                         ✚ noindex 메타
  admin/login/page.tsx                     ✚ 로그인 폼
  admin/(authed)/layout.tsx                ✚ 세션 확인 + 관리자 헤더 (미로그인 → /admin/login)
  admin/(authed)/page.tsx                  ✚ /admin → /admin/properties 리다이렉트
  admin/(authed)/properties/page.tsx       ✚ 매물 목록
  admin/(authed)/properties/new/page.tsx   ✚ 등록
  admin/(authed)/properties/[id]/edit/page.tsx  ✚ 수정
  admin/_components/PropertyForm.tsx       ✚ 등록·수정 공유 폼 (동적 필수항목)
  admin/_components/ImageUploader.tsx      ✚ 리사이즈→업로드→순서·삭제
  admin/_components/MaintenanceFeeEditor.tsx ✚ 관리비 3구분 편집
  properties/[id]/page.tsx                 ✚ 공개 상세 (§4-P3 블록 순서)
  properties/[id]/PhotoCarousel.tsx        ✚ 캐러셀 (클라, 인디케이터)
scripts/
  hash-password.mjs                        ✚ bcrypt 해시 생성 (stdin 입력 — 셸 히스토리에 안 남게)
vitest.config.ts                           ✚ @ alias
package.json                               ✎ 의존성 + "test" 스크립트
```

**레이어 규칙 재확인(RULE-14):** 페이지/컴포넌트 → tRPC(useTRPC 또는 서버 caller) → 서비스 → db. 서버 컴포넌트도 db를 직접 임포트하지 않고 caller를 쓴다. `src/domain`은 어느 레이어에서든 임포트 가능(순수 함수).

---

## 2. 사용자 액션 (Claude가 대신할 수 없는 것 — RULE-1·2)

| # | 액션 | 시점 |
|---|---|---|
| U1 | 개발 `.env`에 `SESSION_SECRET` 추가 — 생성: `openssl rand -base64 48` (Git Bash) | Task 5 전 |
| U2 | 개발 `.env`의 `UPLOAD_DIR` 확인 — **비워두면**(또는 키 삭제) 프로젝트 옆 `oh4989-uploads` 기본값 사용. 서버 경로(`/home/...`)가 적혀 있으면 Windows에서 저장 실패함 | Task 7 전 |
| U3 | 관리자 계정 INSERT — Task 1이 만드는 해시 도구로 해시 생성 후, Claude가 전달하는 SQL을 서버 psql에서 실행 | Task 6 전 |
| U4 | (배포 시) 서버 `shared/oh4989.env`에 `SESSION_SECRET` 추가 — U1과 **다른 값** 권장 | Task 13 |
| U5 | (선택) 사무소 법정정보 확보 시 `site_settings` INSERT — Task 12가 SQL 템플릿 전달 | 아무 때나 |

---

## Task 1: 의존성·테스트 러너·해시 도구

**Files:** ✎ `package.json` · ✚ `vitest.config.ts` · ✚ `scripts/hash-password.mjs`

- [ ] **1-1. 패키지 설치**

```bash
npm i jose bcryptjs
npm i -D vitest
```

bcryptjs 3.x는 타입 내장(@types 불필요). 설치 후 `package.json`의 scripts에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **1-2. vitest 설정** — `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 도메인 단위 테스트 전용. src/domain은 React·DB 없는 순수 함수라 node 환경이면 충분하다.
 * tsconfig의 "@/*" alias를 vitest도 알아야 해서 여기서 한 번 더 선언한다.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **1-3. 해시 도구** — `scripts/hash-password.mjs`

```js
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";

/**
 * 관리자 비밀번호 → bcrypt 해시. INSERT SQL에 붙여넣는 용도.
 *
 * 비밀번호를 argv로 받지 않는다 — 셸 히스토리·프로세스 목록에 평문이 남는다.
 * stdin 프롬프트로만 받는다. 사용: node scripts/hash-password.mjs
 */
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("비밀번호 입력 (화면에 보임, 붙여넣기 가능): ", (password) => {
  rl.close();
  if (password.length < 8) {
    console.error("8자 이상으로 정해 주세요.");
    process.exit(1);
  }
  console.log("\nbcrypt 해시:\n" + bcrypt.hashSync(password, 10));
});
```

- [ ] **1-4. 검증**: `npx tsc --noEmit` 통과. `node scripts/hash-password.mjs` 실행해 해시가 `$2b$10$`로 시작하는지 확인(테스트 입력으로).

- [ ] **1-5. 사용자에게 U1·U2 안내 + INSERT SQL 템플릿 전달** (U3):

```sql
-- 서버에서: psql -U oh4989_app -d oh4989 접속 후
INSERT INTO admin_users (login_id, password_hash)
VALUES ('<아이디>', '<hash-password.mjs 출력값>');
```

---

## Task 2: 도메인 — 가격 (TDD)

**Files:** ✚ `src/domain/price.test.ts` → ✚ `src/domain/price.ts`

- [ ] **2-1. 실패하는 테스트 작성** — `src/domain/price.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { formatManwon, formatMaintenanceFee, formatPropertyPrice } from "./price";

describe("formatManwon", () => {
  it("억 미만은 콤마 숫자", () => {
    expect(formatManwon(3100)).toBe("3,100");
    expect(formatManwon(500)).toBe("500");
    expect(formatManwon(0)).toBe("0");
  });
  it("억 단위 조합", () => {
    expect(formatManwon(43000)).toBe("4억 3,000");
    expect(formatManwon(150000)).toBe("15억");
    expect(formatManwon(25000)).toBe("2억 5,000");
    expect(formatManwon(100000)).toBe("10억");
  });
  it("만원 정수가 아니면 throw (RULE-11 — 부동소수점·문자열 금지의 마지막 방어선)", () => {
    expect(() => formatManwon(1.5)).toThrow();
    expect(() => formatManwon(-100)).toThrow();
    expect(() => formatManwon(NaN)).toThrow();
  });
});

describe("formatPropertyPrice", () => {
  const base = { salePrice: null, deposit: null, monthlyRent: null };
  it("매매 = salePrice", () => {
    expect(formatPropertyPrice({ ...base, dealType: "SALE", salePrice: 43000 })).toBe("4억 3,000");
  });
  it("전세 = deposit", () => {
    expect(formatPropertyPrice({ ...base, dealType: "JEONSE", deposit: 30000 })).toBe("3억");
  });
  it("월세·단기 = 보증금/월세 (디자인가이드 '월세 500/45')", () => {
    expect(formatPropertyPrice({ ...base, dealType: "MONTHLY", deposit: 500, monthlyRent: 45 })).toBe("500/45");
    expect(formatPropertyPrice({ ...base, dealType: "MONTHLY", deposit: 10000, monthlyRent: 60 })).toBe("1억/60");
    expect(formatPropertyPrice({ ...base, dealType: "SHORT", deposit: 100, monthlyRent: 80 })).toBe("100/80");
  });
  it("가격이 비어 있으면(작성 중 HIDDEN) '가격 협의'", () => {
    expect(formatPropertyPrice({ ...base, dealType: "SALE" })).toBe("가격 협의");
  });
});

describe("formatMaintenanceFee", () => {
  it("만원 정수 → '월 10만원'", () => {
    expect(formatMaintenanceFee(10)).toBe("월 10만원");
  });
  it("0 또는 null → '없음' (관리비 없는 매물)", () => {
    expect(formatMaintenanceFee(0)).toBe("없음");
    expect(formatMaintenanceFee(null)).toBe("없음");
  });
});
```

- [ ] **2-2. 실패 확인**: `npx vitest run src/domain/price.test.ts` → FAIL (모듈 없음)

- [ ] **2-3. 구현** — `src/domain/price.ts`

```ts
import type { DealType } from "@/lib/codes";

/**
 * 가격 표기 — 만원 단위 정수(RULE-11)를 한국식 문자열로. 통화기호를 쓰지 않는다.
 * 지도 마커·목록 카드·상세가 전부 이 함수를 쓴다 — 표기가 갈리면 같은 매물이 다른 가격으로 보인다.
 */

/** 만원 정수 → "4억 3,000" · "15억" · "3,100" */
export function formatManwon(manwon: number): string {
  if (!Number.isInteger(manwon) || manwon < 0) {
    throw new Error(`만원 단위 정수가 아닙니다: ${manwon}`);
  }
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok === 0) return rest.toLocaleString("ko-KR");
  if (rest === 0) return `${eok.toLocaleString("ko-KR")}억`;
  return `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}`;
}

export type PropertyPriceInput = {
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
};

/**
 * 거래유형별 대표 가격 문자열. 유형 라벨(배지)은 따로 붙는다.
 * 값이 비어 있으면 "가격 협의" — ACTIVE는 스키마 검증이 가격을 강제하므로
 * 실제로는 작성 중(HIDDEN) 미리보기에서만 나온다.
 */
export function formatPropertyPrice(price: PropertyPriceInput): string {
  switch (price.dealType) {
    case "SALE":
      return price.salePrice === null ? "가격 협의" : formatManwon(price.salePrice);
    case "JEONSE":
      return price.deposit === null ? "가격 협의" : formatManwon(price.deposit);
    case "MONTHLY":
    case "SHORT": {
      if (price.deposit === null || price.monthlyRent === null) return "가격 협의";
      return `${formatManwon(price.deposit)}/${price.monthlyRent.toLocaleString("ko-KR")}`;
    }
  }
}

/** 관리비 총액 표기. 0·null은 "없음" — 관리비 없는 매물의 법정 표기다 */
export function formatMaintenanceFee(manwon: number | null): string {
  if (manwon === null || manwon === 0) return "없음";
  return `월 ${formatManwon(manwon)}만원`;
}
```

- [ ] **2-4. 통과 확인**: `npx vitest run src/domain/price.test.ts` → PASS

---

## Task 3: 도메인 — 층·면적 표기 (TDD)

**Files:** ✚ `src/domain/floor.test.ts` → ✚ `src/domain/floor.ts` · ✚ `src/domain/area.test.ts` → ✚ `src/domain/area.ts`

- [ ] **3-1. 층 테스트** — `src/domain/floor.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { floorBand, formatFloor } from "./floor";

describe("formatFloor — §8 건물유형 3분기", () => {
  it("단독·다가구(TOTAL_ONLY)는 총층만", () => {
    expect(formatFloor({ buildingType: "DETACHED", floor: null, totalFloor: 2, floorDisplay: "EXACT" })).toBe("총 2층");
    // floor 값이 있어도 무시한다 — 법정 표기는 총층만
    expect(formatFloor({ buildingType: "DETACHED", floor: 1, totalFloor: 2, floorDisplay: "EXACT" })).toBe("총 2층");
  });
  it("그 외 주택(EXACT)은 해당층/총층", () => {
    expect(formatFloor({ buildingType: "APT", floor: 3, totalFloor: 15, floorDisplay: "EXACT" })).toBe("3/15층");
  });
  it("EXACT + 저/중/고 대체", () => {
    expect(formatFloor({ buildingType: "APT", floor: 2, totalFloor: 15, floorDisplay: "LOW_MID_HIGH" })).toBe("저/15층");
    expect(formatFloor({ buildingType: "VILLA", floor: 8, totalFloor: 15, floorDisplay: "LOW_MID_HIGH" })).toBe("중/15층");
    expect(formatFloor({ buildingType: "OFFICETEL", floor: 14, totalFloor: 15, floorDisplay: "LOW_MID_HIGH" })).toBe("고/15층");
  });
  it("상가·사무실(EXACT_STRICT)은 저/중/고를 요청해도 정확 표기 — 법정 대체 불가", () => {
    expect(formatFloor({ buildingType: "STORE", floor: 2, totalFloor: 5, floorDisplay: "LOW_MID_HIGH" })).toBe("2/5층");
  });
  it("지하층은 B 표기", () => {
    expect(formatFloor({ buildingType: "STORE", floor: -1, totalFloor: 5, floorDisplay: "EXACT" })).toBe("B1/5층");
  });
  it("EXACT인데 floor가 비어 있으면(작성 중) 총층만으로 강등", () => {
    expect(formatFloor({ buildingType: "APT", floor: null, totalFloor: 15, floorDisplay: "EXACT" })).toBe("총 15층");
  });
  it("토지 등 총층 0은 표기 생략", () => {
    expect(formatFloor({ buildingType: "LAND", floor: null, totalFloor: 0, floorDisplay: "EXACT" })).toBe("-");
  });
});

describe("floorBand — 총층 3등분(올림 경계)", () => {
  it("15층: 1~5 저 / 6~10 중 / 11~15 고", () => {
    expect(floorBand(5, 15)).toBe("저");
    expect(floorBand(6, 15)).toBe("중");
    expect(floorBand(11, 15)).toBe("고");
  });
  it("지하·반지하는 항상 저", () => {
    expect(floorBand(-1, 15)).toBe("저");
  });
});
```

- [ ] **3-2. 실패 확인** → **3-3. 구현** — `src/domain/floor.ts`

```ts
import {
  FLOOR_RULE_BY_BUILDING_TYPE,
  type BuildingType,
  type FloorDisplay,
} from "@/lib/codes";

/**
 * 층 표기 (공인중개사법 제18조의2, 디자인가이드 §8).
 * 상세 화면·목록 카드·관리자 미리보기가 전부 이 함수를 거친다.
 * 분기 규칙 자체는 codes.ts의 FLOOR_RULE_BY_BUILDING_TYPE이 단일 출처다.
 */

export type FloorFormatInput = {
  buildingType: BuildingType;
  floor: number | null;
  totalFloor: number;
  floorDisplay: FloorDisplay;
};

/** 해당층의 저/중/고 밴드 — 총층 3등분, 경계 올림. 지하는 항상 저 */
export function floorBand(floor: number, totalFloor: number): "저" | "중" | "고" {
  if (floor <= 0) return "저";
  const bandSize = Math.ceil(totalFloor / 3);
  if (floor <= bandSize) return "저";
  if (floor <= bandSize * 2) return "중";
  return "고";
}

/** 지하 음수 층 → "B1" */
function formatFloorNumber(floor: number): string {
  return floor < 0 ? `B${-floor}` : String(floor);
}

export function formatFloor(input: FloorFormatInput): string {
  if (input.totalFloor === 0) return "-"; // 토지 — 층 개념 없음
  const rule = FLOOR_RULE_BY_BUILDING_TYPE[input.buildingType];
  if (rule === "TOTAL_ONLY" || input.floor === null) return `총 ${input.totalFloor}층`;
  if (rule === "EXACT" && input.floorDisplay === "LOW_MID_HIGH") {
    return `${floorBand(input.floor, input.totalFloor)}/${input.totalFloor}층`;
  }
  // EXACT_STRICT는 floorDisplay 값과 무관하게 정확 표기 — 저/중/고 대체 불가(법정)
  return `${formatFloorNumber(input.floor)}/${input.totalFloor}층`;
}
```

- [ ] **3-4. 면적 테스트** — `src/domain/area.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { formatArea } from "./area";

describe("formatArea", () => {
  it("㎡ + 평 병기 (평 = ㎡ / 3.3058, 소수 1자리)", () => {
    expect(formatArea("84.9")).toBe("84.9㎡ (25.7평)");
    expect(formatArea("33.0")).toBe("33㎡ (10평)");
  });
  it("잘못된 문자열은 throw — numeric 컬럼이 string으로 오는 것을 전제", () => {
    expect(() => formatArea("abc")).toThrow();
  });
});
```

- [ ] **3-5. 실패 확인** → **3-6. 구현** — `src/domain/area.ts`

```ts
/**
 * 면적 표기. exclusiveArea/supplyArea는 numeric 컬럼이라 drizzle에서 **string**으로 온다.
 * 전용면적(㎡)은 법정 필수, 평 병기는 40~60대 주 사용자층의 관례 단위 대응.
 */

const PYEONG_PER_SQM = 3.3058;

export function formatArea(sqmString: string): string {
  const sqm = Number(sqmString);
  if (!Number.isFinite(sqm) || sqm < 0) {
    throw new Error(`면적 값이 아닙니다: ${sqmString}`);
  }
  const pyeong = sqm / PYEONG_PER_SQM;
  // 84.9 → "84.9", 33.0 → "33" (트레일링 .0 제거)
  const sqmText = String(Number(sqm.toFixed(1)));
  const pyeongText = String(Number(pyeong.toFixed(1)));
  return `${sqmText}㎡ (${pyeongText}평)`;
}
```

- [ ] **3-7. 통과 확인**: `npx vitest run src/domain` → 전부 PASS

---

## Task 4: 도메인 — 매물 입력 스키마 (TDD)

**Files:** ✚ `src/domain/property-schema.test.ts` → ✚ `src/domain/property-schema.ts`

폼(클라)과 admin 라우터(서버)가 **같은 스키마**를 임포트한다. 법정 필수 검증의 단일 출처.

- [ ] **4-1. 테스트** — `src/domain/property-schema.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { propertySaveSchema } from "./property-schema";

/** 검증 통과하는 최소 ACTIVE 아파트 전세 매물 */
const validBase = {
  title: "배곧 신도시 아파트 전세",
  buildingType: "APT",
  dealType: "JEONSE",
  status: "ACTIVE",
  salePrice: null,
  deposit: 30000,
  monthlyRent: null,
  exclusiveArea: 84.9,
  supplyArea: null,
  floor: 3,
  totalFloor: 15,
  floorDisplay: "EXACT",
  roomCount: 3,
  bathCount: 2,
  direction: "S",
  directionBase: "안방",
  moveInDate: "즉시입주",
  approvalDate: "2020-05-14",
  parkingTotal: 1,
  parkingPerUnit: null,
  buildingUse: "공동주택",
  maintenanceFee: 10,
  maintenanceDetail: null,
  sido: "경기",
  sigungu: "시흥시",
  dong: "배곧동",
  bjdCode: "4139013200",
  jibunAddress: "경기 시흥시 배곧동 123-4",
  roadAddress: null,
  detailAddress: null,
  lat: 37.3799,
  lng: 126.7291,
  description: "",
  videoUrl: null,
  videoDuration: null,
  videoSummary: null,
  fieldCheckedAt: null,
  optionCodes: [],
  images: [],
} as const;

describe("propertySaveSchema — 공통", () => {
  it("유효한 ACTIVE 매물은 통과", () => {
    expect(propertySaveSchema.safeParse(validBase).success).toBe(true);
  });
  it("가격은 만원 단위 정수만 (RULE-11)", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, deposit: 30000.5 }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, deposit: -1 }).success).toBe(false);
  });
  it("법정동코드는 숫자 10자리", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, bjdCode: "413901320" }).success).toBe(false);
  });
  it("좌표는 한국 범위", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, lat: 50 }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, lng: 100 }).success).toBe(false);
  });
  it("이미지 경로는 저장 패턴만 — 임의 경로로 DB를 오염시키지 못한다", () => {
    const ok = { filePath: "properties/202608/0123456789abcdef01234567.jpg", thumbPath: "properties/202608/0123456789abcdef01234567-thumb.jpg" };
    expect(propertySaveSchema.safeParse({ ...validBase, images: [ok] }).success).toBe(true);
    expect(propertySaveSchema.safeParse({ ...validBase, images: [{ ...ok, filePath: "../../etc/passwd" }] }).success).toBe(false);
  });
});

describe("propertySaveSchema — 거래유형별 가격 (ACTIVE에서만 강제)", () => {
  it("SALE인데 salePrice 없으면 거부", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, dealType: "SALE", salePrice: null }).success).toBe(false);
  });
  it("MONTHLY는 보증금+월세 둘 다", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, dealType: "MONTHLY", deposit: 500, monthlyRent: null }).success).toBe(false);
    expect(propertySaveSchema.safeParse({ ...validBase, dealType: "MONTHLY", deposit: 500, monthlyRent: 45 }).success).toBe(true);
  });
  it("HIDDEN(작성 중)이면 가격이 없어도 저장 가능 — DB CHECK를 안 둔 것과 같은 이유", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, status: "HIDDEN", dealType: "SALE", salePrice: null }).success).toBe(true);
  });
});

describe("propertySaveSchema — 건물유형별 층·방향 (ACTIVE)", () => {
  it("EXACT 유형인데 floor 없으면 거부", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, floor: null }).success).toBe(false);
  });
  it("단독(TOTAL_ONLY)은 floor 없어도 통과", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, buildingType: "DETACHED", floor: null }).success).toBe(true);
  });
  it("상가(EXACT_STRICT)는 floorDisplay=LOW_MID_HIGH를 거부 — 입력 단계에서 차단", () => {
    expect(
      propertySaveSchema.safeParse({
        ...validBase, buildingType: "STORE", floorDisplay: "LOW_MID_HIGH",
        roomCount: null, bathCount: null, direction: null,
      }).success,
    ).toBe(false);
  });
  it("주거형은 방/욕실/방향 필수, 상가·사무실·토지는 면제", () => {
    expect(propertySaveSchema.safeParse({ ...validBase, roomCount: null }).success).toBe(false);
    expect(
      propertySaveSchema.safeParse({
        ...validBase, buildingType: "STORE", roomCount: null, bathCount: null, direction: null,
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **4-2. 실패 확인** → **4-3. 구현** — `src/domain/property-schema.ts`

```ts
import { z } from "zod";

import {
  BUILDING_TYPES,
  DEAL_TYPES,
  DIRECTIONS,
  FLOOR_DISPLAY,
  FLOOR_RULE_BY_BUILDING_TYPE,
  MAINTENANCE_GROUPS,
  PROPERTY_OPTIONS,
  PROPERTY_STATUS,
  type BuildingType,
} from "@/lib/codes";

/**
 * 매물 저장 입력 스키마 — 관리자 등록 폼과 admin.property 라우터가 공유한다.
 *
 * "법정 필수항목 누락 시 저장 차단"(SPEC §5)의 구현 지점이다. DB CHECK를 두지 않은
 * 대신 여기서 막는다. 단 **작성 중(HIDDEN) 매물은 느슨하게** 저장을 허용한다 —
 * 공개(ACTIVE) 시점에만 법정 요건을 강제한다. COMPLETED는 ACTIVE였던 매물이므로 동일 강제.
 */

/** 만원 단위 정수 (RULE-11) */
const manwon = z.number().int().min(0);

/** 업로드 라우트가 발급한 경로만 통과 — 임의 경로 주입 차단 */
export const STORED_IMAGE_PATH = /^properties\/\d{6}\/[a-f0-9]{24}\.jpg$/;
export const STORED_THUMB_PATH = /^properties\/\d{6}\/[a-f0-9]{24}-thumb\.jpg$/;

const imageInput = z.object({
  id: z.number().int().positive().optional(), // 있으면 기존 행 유지, 없으면 신규
  filePath: z.string().regex(STORED_IMAGE_PATH, "잘못된 이미지 경로입니다."),
  thumbPath: z.string().regex(STORED_THUMB_PATH, "잘못된 썸네일 경로입니다."),
});

const maintenanceDetailInput = z.record(
  z.enum(MAINTENANCE_GROUPS),
  z.array(z.object({ item: z.string().trim().min(1).max(30), amount: manwon })),
);

/** 방·욕실·방향이 법정 필수인 주거형 — 상가·사무실·토지는 면제 */
export function isResidential(buildingType: BuildingType): boolean {
  return buildingType !== "STORE" && buildingType !== "OFFICE" && buildingType !== "LAND";
}

export const propertySaveSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력해 주세요.").max(100),
    buildingType: z.enum(BUILDING_TYPES),
    dealType: z.enum(DEAL_TYPES),
    status: z.enum(PROPERTY_STATUS),

    salePrice: manwon.nullable(),
    deposit: manwon.nullable(),
    monthlyRent: manwon.nullable(),

    // numeric 컬럼이지만 입력은 number로 받고 서비스에서 string 변환
    exclusiveArea: z.number().positive().multipleOf(0.1),
    supplyArea: z.number().positive().multipleOf(0.1).nullable(),

    floor: z.number().int().min(-9).max(200).nullable(),
    totalFloor: z.number().int().min(0).max(200),
    floorDisplay: z.enum(FLOOR_DISPLAY),

    roomCount: z.number().int().min(0).max(50).nullable(),
    bathCount: z.number().int().min(0).max(50).nullable(),
    direction: z.enum(DIRECTIONS).nullable(),
    directionBase: z.string().trim().max(20).nullable(),
    moveInDate: z.string().trim().max(20).nullable(),
    approvalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    parkingTotal: z.number().int().min(0).max(10000).nullable(),
    parkingPerUnit: z.number().min(0).max(99).nullable(),
    buildingUse: z.string().trim().max(50).nullable(),

    maintenanceFee: manwon.nullable(),
    maintenanceDetail: maintenanceDetailInput.nullable(),

    sido: z.string().trim().min(1).max(20),
    sigungu: z.string().trim().min(1).max(30),
    dong: z.string().trim().min(1).max(30),
    bjdCode: z.string().regex(/^\d{10}$/, "법정동코드는 숫자 10자리입니다."),
    jibunAddress: z.string().trim().min(1).max(200),
    roadAddress: z.string().trim().max(200).nullable(),
    detailAddress: z.string().trim().max(100).nullable(),

    lat: z.number().min(33).max(39), // 한국 위경도 범위 밖이면 입력 실수
    lng: z.number().min(124).max(132),

    description: z.string().max(5000),
    videoUrl: z.string().trim().url().max(300).nullable(),
    videoDuration: z.string().trim().max(10).nullable(),
    videoSummary: z.string().trim().max(100).nullable(),
    fieldCheckedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),

    optionCodes: z.array(z.enum(PROPERTY_OPTIONS)).max(PROPERTY_OPTIONS.length),
    images: z.array(imageInput).max(20),
  })
  .superRefine((value, ctx) => {
    // 상가·사무실은 상태와 무관하게 저/중/고 대체가 불법 — 항상 차단
    const floorRule = FLOOR_RULE_BY_BUILDING_TYPE[value.buildingType];
    if (floorRule === "EXACT_STRICT" && value.floorDisplay === "LOW_MID_HIGH") {
      ctx.addIssue({
        code: "custom", path: ["floorDisplay"],
        message: "상가·사무실은 저/중/고 표기로 대체할 수 없습니다(법정).",
      });
    }

    if (value.status === "HIDDEN") return; // 작성 중 — 법정 필수 검증 유예

    /* ── 이하 공개(ACTIVE·COMPLETED) 시 법정 필수 (§8) ── */
    const requirePrice = (field: "salePrice" | "deposit" | "monthlyRent") => {
      if (value[field] === null) {
        ctx.addIssue({ code: "custom", path: [field], message: "공개 매물은 가격이 필수입니다." });
      }
    };
    if (value.dealType === "SALE") requirePrice("salePrice");
    if (value.dealType === "JEONSE") requirePrice("deposit");
    if (value.dealType === "MONTHLY" || value.dealType === "SHORT") {
      requirePrice("deposit");
      requirePrice("monthlyRent");
    }

    if (floorRule !== "TOTAL_ONLY" && value.floor === null) {
      ctx.addIssue({ code: "custom", path: ["floor"], message: "해당 층을 입력해 주세요." });
    }

    if (isResidential(value.buildingType)) {
      if (value.roomCount === null)
        ctx.addIssue({ code: "custom", path: ["roomCount"], message: "방 수는 법정 필수입니다." });
      if (value.bathCount === null)
        ctx.addIssue({ code: "custom", path: ["bathCount"], message: "욕실 수는 법정 필수입니다." });
      if (value.direction === null)
        ctx.addIssue({ code: "custom", path: ["direction"], message: "방향은 법정 필수입니다." });
    }

    for (const [field, label] of [
      ["moveInDate", "입주가능일"],
      ["approvalDate", "행정기관 승인일자"],
      ["parkingTotal", "주차대수"],
      ["buildingUse", "건축물 용도"],
      ["maintenanceFee", "관리비"],
    ] as const) {
      if (value[field] === null) {
        ctx.addIssue({ code: "custom", path: [field], message: `${label}은(는) 법정 필수입니다.` });
      }
    }
  });

export type PropertySaveInput = z.infer<typeof propertySaveSchema>;
```

주의: `maintenanceFee`는 `0`(없음)이 유효값이다 — null만 미입력으로 본다.

- [ ] **4-4. 통과 확인**: `npx vitest run src/domain` → 전부 PASS. `npx tsc --noEmit`.

---

## Task 5: 관리자 세션 + 컨텍스트 연결

**Files:** ✚ `src/server/auth/admin-session.ts` · ✎ `src/server/trpc/context.ts`

**선행:** 사용자 U1 완료(`SESSION_SECRET`).

- [ ] **5-1. 세션 모듈** — PaRaSOL `admin-session.ts` 이식 개작. 차이점: env 키 `SESSION_SECRET`(이 프로젝트 `.env.example` 기준), 쿠키 이름 `oh4989_admin`, 고객 세션이 없으므로 `readCookieValueFromHeader` 헬퍼를 이 파일에 내장.

```ts
import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

/**
 * 관리자 세션 — jose HS256 서명 쿠키. DB 세션 테이블을 두지 않는다(1~2계정 규모).
 *
 * 이 사이트는 비회원 전용이라 세션 주체가 관리자 하나뿐이지만, PaRaSOL의
 * aud 클레임(=admin)은 유지한다 — 비용이 0이고 토큰의 용도를 자기서술하게 만든다.
 * 수명 8시간: 근무 단위. 공용 PC에서 열릴 수 있는 관리 화면의 권한이 크다.
 */

export const ADMIN_SESSION_COOKIE_NAME = "oh4989_admin";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const ADMIN_TOKEN_AUDIENCE = "admin";

function getSessionSecretKey(): Uint8Array {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET 환경변수가 없거나 32자 미만입니다. .env에 32자 이상 랜덤 문자열을 설정하세요.",
    );
  }
  return new TextEncoder().encode(sessionSecret);
}

/** 로그인 성공 시 세션 쿠키 발급 */
export async function issueAdminSessionCookie(adminUserId: number): Promise<void> {
  const sessionJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminUserId))
    .setAudience(ADMIN_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, sessionJwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", // tRPC(/api/trpc)·업로드(/api/admin)가 함께 쓴다
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

function readCookieValueFromHeader(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * 세션에서 adminUserId 해석. 위조·만료는 전부 null.
 * cookieHeader를 주면 그것만 보고(라우트 핸들러·tRPC 컨텍스트),
 * 안 주면 next/headers의 cookies()를 읽는다(서버 컴포넌트).
 */
export async function readAdminSessionUserId(
  cookieHeader?: string | null,
): Promise<number | null> {
  let sessionJwt: string | null;
  if (cookieHeader === undefined) {
    const cookieStore = await cookies();
    sessionJwt = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  } else {
    sessionJwt = cookieHeader
      ? readCookieValueFromHeader(cookieHeader, ADMIN_SESSION_COOKIE_NAME)
      : null;
  }
  if (!sessionJwt) return null;

  try {
    const { payload } = await jwtVerify(sessionJwt, getSessionSecretKey(), {
      algorithms: ["HS256"],
      audience: ADMIN_TOKEN_AUDIENCE,
    });
    const parsedAdminUserId = Number(payload.sub);
    if (!Number.isInteger(parsedAdminUserId) || parsedAdminUserId <= 0) return null;
    return parsedAdminUserId;
  } catch {
    return null;
  }
}

/** 로그아웃 — 같은 속성으로 덮어써야 브라우저가 확실히 지운다 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
```

- [ ] **5-2. 컨텍스트 연결** — `src/server/trpc/context.ts`의 `createTRPCContext`에서 `adminUserId: null` 고정을 세션 판독으로 교체. 기존 주석("Phase 1에서 채운다")도 함께 정리.

```ts
import { readAdminSessionUserId } from "@/server/auth/admin-session";
// ...
export async function createTRPCContext(opts: { headers: Headers }) {
  return {
    db,
    adminUserId: await readAdminSessionUserId(opts.headers.get("cookie")),
    clientIp: readClientIp(opts.headers),
  };
}
```

- [ ] **5-3. 검증**: `npx tsc --noEmit` · `npx eslint src` 통과. dev 서버에서 `health.adminPing`이 **여전히 403**(쿠키 없음)인지 브라우저로 확인 — 경계가 열리지 않았어야 한다.

---

## Task 6: 로그인 서비스 + admin.auth 라우터

**Files:** ✚ `src/server/services/admin-auth.service.ts` · ✚ `src/server/trpc/routers/admin-auth.ts` · ✎ `src/server/trpc/routers/_app.ts`

**선행:** 사용자 U3 완료(관리자 계정 INSERT).

- [ ] **6-1. 서비스** — `src/server/services/admin-auth.service.ts`

```ts
import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { adminUsers } from "@/db/schema";

/**
 * 관리자 로그인 검증 + 브루트포스 잠금.
 *
 * `/admin`은 공개 경로라 로그인 폼이 그대로 노출된다. 잠금 상태는 DB 컬럼
 * (failedLoginCount/lockedUntil)에 둔다 — 단일 프로세스 메모리로도 되지만,
 * PM2 재시작·재배포마다 잠금이 풀리면 방어가 아니다.
 */

const MAX_FAILED_LOGIN_COUNT = 5;
const LOCK_DURATION_MINUTES = 15;

/** 아이디 없음·비밀번호 불일치를 구분하지 않는다 — 계정 존재 여부를 흘리지 않는다 */
export class AdminLoginFailedError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AdminLoginFailedError";
  }
}

export class AdminAccountLockedError extends Error {
  constructor(readonly lockedUntil: Date) {
    super("로그인 실패가 반복되어 잠시 잠겼습니다. 15분 후 다시 시도해 주세요.");
    this.name = "AdminAccountLockedError";
  }
}

export async function verifyAdminLogin(
  db: Db,
  input: { loginId: string; password: string },
): Promise<{ adminUserId: number }> {
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.loginId, input.loginId));
  if (!admin) throw new AdminLoginFailedError();

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new AdminAccountLockedError(admin.lockedUntil);
  }

  const passwordMatches = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordMatches) {
    const nextFailedCount = admin.failedLoginCount + 1;
    const shouldLock = nextFailedCount >= MAX_FAILED_LOGIN_COUNT;
    await db
      .update(adminUsers)
      .set({
        // 잠글 때 카운트를 0으로 리셋 — 잠금 해제 후 첫 실패가 다시 1부터 센다
        failedLoginCount: shouldLock ? 0 : nextFailedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000)
          : null,
      })
      .where(eq(adminUsers.id, admin.id));
    if (shouldLock) {
      throw new AdminAccountLockedError(new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000));
    }
    throw new AdminLoginFailedError();
  }

  await db
    .update(adminUsers)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(adminUsers.id, admin.id));
  return { adminUserId: admin.id };
}
```

- [ ] **6-2. 라우터** — `src/server/trpc/routers/admin-auth.ts`

```ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  clearAdminSessionCookie,
  issueAdminSessionCookie,
} from "@/server/auth/admin-session";
import {
  AdminAccountLockedError,
  AdminLoginFailedError,
  verifyAdminLogin,
} from "@/server/services/admin-auth.service";

import { adminProcedure, publicProcedure, router } from "../init";

/** 관리자 인증 — login만 public(아직 세션이 없다), 나머지는 admin */
export const adminAuthRouter = router({
  /** 관리자 셸이 부른다 — 비로그인이면 null(로그인 화면으로) */
  getSession: publicProcedure.query(({ ctx }) =>
    ctx.adminUserId === null ? null : { adminUserId: ctx.adminUserId },
  ),

  login: publicProcedure
    .input(
      z.object({
        loginId: z.string().trim().min(1, "아이디를 입력해 주세요.").max(40),
        password: z.string().min(1, "비밀번호를 입력해 주세요.").max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { adminUserId } = await verifyAdminLogin(ctx.db, input);
        await issueAdminSessionCookie(adminUserId);
        return { ok: true as const };
      } catch (loginError) {
        if (loginError instanceof AdminAccountLockedError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: loginError.message });
        }
        if (loginError instanceof AdminLoginFailedError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: loginError.message });
        }
        throw loginError;
      }
    }),

  logout: adminProcedure.mutation(async () => {
    await clearAdminSessionCookie();
    return { ok: true as const };
  }),
});
```

- [ ] **6-3. `_app.ts`에 admin 네임스페이스 등록** (Task 8·9의 라우터 자리도 이 구조로 들어간다)

```ts
export const appRouter = router({
  health: healthRouter,
  admin: router({
    auth: adminAuthRouter,
  }),
});
```

- [ ] **6-4. 검증 (인증 경계 실측)**: `npx tsc --noEmit` 통과 후 dev 서버 기동. 브라우저 devtools 콘솔 또는 preview에서:
  1. `admin.auth.login` 호출(오답) → UNAUTHORIZED, 5회 반복 → TOO_MANY_REQUESTS
  2. 정답 로그인 → `{ok:true}` + 응답 Set-Cookie `oh4989_admin`
  3. `health.adminPing` → **200** (Phase 0 이후 처음으로 통과)
  4. `admin.auth.logout` → 이후 `adminPing` 다시 403

잠금 해제 SQL(검증 중 잠겼을 때 사용자에게 전달): `UPDATE admin_users SET failed_login_count = 0, locked_until = NULL WHERE login_id = '<아이디>';`

---

## Task 7: 이미지 저장 서비스 + 업로드·서빙 라우트

**Files:** ✚ `src/server/services/image-storage.service.ts` · ✚ `src/app/api/admin/property-images/route.ts` · ✚ `src/app/uploads/[...storagePath]/route.ts` · ✚ `src/lib/image-resize.ts`

**선행:** 사용자 U2 완료(UPLOAD_DIR).

- [ ] **7-1. 저장 서비스** — PaRaSOL `image-storage.service.ts` 이식 개작. 차이점: ① 폴더 `properties` 단일 ② **상세+썸네일 쌍 저장** ③ JPEG만 허용(클라가 전량 재인코딩하므로, 다른 MIME은 화면을 우회한 공격) ④ env `UPLOAD_DIR`, 개발 기본값 `oh4989-uploads`.

```ts
import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 매물 사진 저장 — 로컬 디스크, 릴리스 폴더 밖(재배포에도 남는다).
 *
 * 저장 경로: {UPLOAD_DIR}/properties/{yyyymm}/{hex24}.jpg (+ 같은 이름 -thumb.jpg)
 * 상세·썸네일 2종은 브라우저 Canvas가 만들어 보낸다(SPEC 수정 이력 #2) —
 * 서버는 검증·저장만 한다. Canvas 재인코딩이 EXIF(촬영 GPS)를 제거하므로
 * 상세주소 비공개 원칙(RULE-11)이 사진 메타데이터로 새지 않는다.
 *
 * JPEG만 받는 이유: 정상 경로(등록 폼)는 항상 JPEG를 보낸다. 다른 형식이 왔다는
 * 것은 화면을 우회해 API를 직접 두드렸다는 뜻이다.
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // Canvas 축소 후 실측 수백 KB — 10MB는 우회 공격 방어선

export class UnsupportedImageTypeError extends Error {
  constructor() {
    super("JPEG 이미지만 올릴 수 있습니다.");
    this.name = "UnsupportedImageTypeError";
  }
}
export class ImageTooLargeError extends Error {
  constructor() {
    super("이미지 한 장은 10MB까지 올릴 수 있습니다.");
    this.name = "ImageTooLargeError";
  }
}
export class ImageNotFoundError extends Error {
  constructor(readonly storagePath: string) {
    super(`이미지를 찾을 수 없습니다: ${storagePath}`);
    this.name = "ImageNotFoundError";
  }
}

const DEFAULT_UPLOAD_DIR_NAME = "oh4989-uploads";

/**
 * 업로드 루트 — 항상 프로젝트 밖. 운영에서 UPLOAD_DIR가 없으면 기본값으로 넘어가지
 * 않고 멈춘다(릴리스 폴더 옆에 조용히 쌓이면 다음 배포 때 "사진이 사라졌다"가 된다).
 */
function getUploadRootDir(): string {
  const configuredDir = process.env.UPLOAD_DIR;
  if (configuredDir) return path.resolve(configuredDir);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "UPLOAD_DIR가 설정되지 않았습니다. 절대경로(예: /home/oh4989/shared/uploads)를 지정해 주세요.",
    );
  }
  return path.join(path.dirname(process.cwd()), DEFAULT_UPLOAD_DIR_NAME);
}

/**
 * 저장 상대경로 → 실제 파일 경로. **경로 이탈 방어의 유일한 지점** —
 * 정규화한 절대경로가 루트 밖이면 우리 파일이 아니다.
 */
export function resolveStoredImageFile(storagePath: string): string {
  const rootDir = getUploadRootDir();
  const resolved = path.resolve(rootDir, storagePath);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (!resolved.startsWith(rootWithSep)) throw new ImageNotFoundError(storagePath);
  return resolved;
}

export type StoredPropertyImagePair = { filePath: string; thumbPath: string };

/** 상세+썸네일 쌍 저장. 같은 hex 이름을 공유해 디스크에서 짝을 추적할 수 있다 */
export async function storePropertyImagePair(input: {
  detailBytes: ArrayBuffer;
  thumbBytes: ArrayBuffer;
  mimeType: string;
  now: Date;
}): Promise<StoredPropertyImagePair> {
  if (input.mimeType !== "image/jpeg") throw new UnsupportedImageTypeError();
  if (
    input.detailBytes.byteLength > MAX_IMAGE_BYTES ||
    input.thumbBytes.byteLength > MAX_IMAGE_BYTES
  ) {
    throw new ImageTooLargeError();
  }

  const yearMonth = `${input.now.getFullYear()}${String(input.now.getMonth() + 1).padStart(2, "0")}`;
  const baseName = randomBytes(12).toString("hex"); // 24 hex — 파일명 재생성(경로 이탈·덮어쓰기 차단)
  const filePath = `properties/${yearMonth}/${baseName}.jpg`;
  const thumbPath = `properties/${yearMonth}/${baseName}-thumb.jpg`;

  const detailAbsolute = resolveStoredImageFile(filePath);
  await mkdir(path.dirname(detailAbsolute), { recursive: true });
  await writeFile(detailAbsolute, Buffer.from(input.detailBytes));
  await writeFile(resolveStoredImageFile(thumbPath), Buffer.from(input.thumbBytes));

  return { filePath, thumbPath };
}

export async function readStoredImage(storagePath: string): Promise<Buffer> {
  const absolutePath = resolveStoredImageFile(storagePath);
  try {
    return await readFile(absolutePath);
  } catch {
    throw new ImageNotFoundError(storagePath);
  }
}

/** "이미 없음"과 "실패"를 구분해 돌려준다 — 실패한 파일을 잊으면 영구 고아가 된다 */
export async function deleteStoredImage(
  storagePath: string,
): Promise<"deleted" | "missing" | "failed"> {
  let absolutePath: string;
  try {
    absolutePath = resolveStoredImageFile(storagePath);
  } catch {
    return "missing";
  }
  try {
    await unlink(absolutePath);
    return "deleted";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    return "failed";
  }
}
```

- [ ] **7-2. 업로드 라우트** — `src/app/api/admin/property-images/route.ts`. multipart라 tRPC 밖. FormData 규약: `detail`·`thumb`을 같은 인덱스 쌍으로 `append`.

```ts
import { NextResponse } from "next/server";

import { readAdminSessionUserId } from "@/server/auth/admin-session";
import {
  ImageTooLargeError,
  MAX_IMAGE_BYTES,
  storePropertyImagePair,
  UnsupportedImageTypeError,
} from "@/server/services/image-storage.service";

/**
 * 매물 사진 업로드 — multipart라 tRPC가 아니라 라우트 핸들러다.
 * adminProcedure가 하던 방어(세션 판독)를 여기서 직접 한다. DB 재확인은 하지 않는다
 * — adminProcedure와 같은 수준으로 맞춘다(§0 사전 결정).
 *
 * FormData: detail[i]와 thumb[i]가 한 장의 사진이다. 클라(ImageUploader)가
 * Canvas로 2종을 만들어 쌍으로 보낸다.
 */

const MAX_PAIRS_PER_REQUEST = 10;

export async function POST(request: Request) {
  const adminUserId = await readAdminSessionUserId(request.headers.get("cookie"));
  if (adminUserId === null) {
    return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "업로드 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const detailFiles = formData.getAll("detail").filter((e): e is File => e instanceof File);
  const thumbFiles = formData.getAll("thumb").filter((e): e is File => e instanceof File);

  if (detailFiles.length === 0 || detailFiles.length !== thumbFiles.length) {
    return NextResponse.json(
      { message: "상세·썸네일 쌍이 맞지 않습니다. 새로고침 후 다시 시도해 주세요." },
      { status: 400 },
    );
  }
  if (detailFiles.length > MAX_PAIRS_PER_REQUEST) {
    return NextResponse.json(
      { message: `한 번에 ${MAX_PAIRS_PER_REQUEST}장까지 올릴 수 있습니다.` },
      { status: 400 },
    );
  }
  // 저장 전에 전량 검사 — 절반만 저장되고 실패하면 고아 파일이 남는다
  for (const file of [...detailFiles, ...thumbFiles]) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ message: "이미지 한 장은 10MB까지입니다." }, { status: 400 });
    }
    if (file.type !== "image/jpeg") {
      return NextResponse.json({ message: "JPEG 이미지만 올릴 수 있습니다." }, { status: 400 });
    }
  }

  const now = new Date();
  const storedImages = [];
  try {
    for (let i = 0; i < detailFiles.length; i++) {
      storedImages.push(
        await storePropertyImagePair({
          detailBytes: await detailFiles[i].arrayBuffer(),
          thumbBytes: await thumbFiles[i].arrayBuffer(),
          mimeType: detailFiles[i].type,
          now,
        }),
      );
    }
  } catch (error) {
    if (error instanceof UnsupportedImageTypeError || error instanceof ImageTooLargeError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }

  // 경로만 돌려준다 — property_images 연결은 매물 저장 때 한 번에(주인 없는 경로는 폼이 기억)
  return NextResponse.json({ images: storedImages });
}
```

- [ ] **7-3. 서빙 라우트** — `src/app/uploads/[...storagePath]/route.ts`. 운영은 nginx `/uploads/` alias가 선점하므로 **개발 전용으로 동작**하는 셈이지만, 코드는 환경을 구분하지 않는다(nginx 설정이 빠져도 동작하는 폴백). 인증 없음 — 공개 상세가 보여줘야 한다. PaRaSOL 서빙 라우트와 동일 구조 + Content-Type은 `image/jpeg` 고정(JPEG만 저장하므로).

```ts
import { NextResponse } from "next/server";

import {
  ImageNotFoundError,
  readStoredImage,
} from "@/server/services/image-storage.service";

/**
 * 업로드 사진 서빙 — 업로드 루트가 public/ 밖이라 라우트가 읽어 내보낸다.
 * 운영에서는 nginx가 /uploads/ 를 alias로 먼저 서빙하므로 이 라우트는 개발에서만 돈다.
 * 경로 이탈은 image-storage(resolveStoredImageFile)가 막는다 — 여기서 경로를 조립하지 않는다.
 */

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"; // 파일명에 랜덤 — 내용이 바뀌면 경로가 바뀐다

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storagePath: string[] }> },
) {
  const { storagePath } = await params;
  try {
    const fileBytes = await readStoredImage(storagePath.join("/"));
    return new NextResponse(new Uint8Array(fileBytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": IMMUTABLE_CACHE,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (error instanceof ImageNotFoundError) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
```

- [ ] **7-4. 클라 리사이즈** — `src/lib/image-resize.ts`. PaRaSOL `image-resize.ts` 개작: 한 원본에서 **2종 생성**, 출력 전부 JPEG.

```ts
/**
 * 업로드 전 이미지 2종 생성 — 브라우저 Canvas (SPEC 수정 이력 #2, sharp 도입 금지).
 *
 * Canvas에는 픽셀만 옮겨진다 — EXIF(촬영 GPS 포함)가 여기서 소멸한다.
 * 상세주소 비공개(RULE-11)가 사진 메타데이터로 새지 않게 하는 실제 장치가 이 파일이다.
 * 그래서 PNG도 투명도 보존 없이 전부 JPEG로 재인코딩한다(매물 사진에 투명도는 무의미).
 *
 * `imageOrientation: "from-image"`: 없으면 휴대폰 세로 사진이 EXIF 회전을 잃고 눕는다.
 */

const DETAIL_MAX_PX = 1600; // PC 상세 2단 폭 ~800px × 레티나 2배
const THUMB_MAX_PX = 480; // 목록 카드·마커 미리보기 ~200px × 2~3배
const DETAIL_JPEG_QUALITY = 0.85;
const THUMB_JPEG_QUALITY = 0.8;

export type PropertyImagePair = { detailBlob: Blob; thumbBlob: Blob };

function fitWithin(width: number, height: number, maxPx: number) {
  if (width <= maxPx && height <= maxPx) return { width, height };
  const ratio = Math.min(maxPx / width, maxPx / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function drawToJpeg(bitmap: ImageBitmap, maxPx: number, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxPx);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리할 수 없습니다. 다른 브라우저에서 시도해 주세요.");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("이미지를 변환하지 못했습니다. 다시 시도해 주세요.");
  return blob;
}

export async function createPropertyImagePair(file: File): Promise<PropertyImagePair> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return {
      detailBlob: await drawToJpeg(bitmap, DETAIL_MAX_PX, DETAIL_JPEG_QUALITY),
      thumbBlob: await drawToJpeg(bitmap, THUMB_MAX_PX, THUMB_JPEG_QUALITY),
    };
  } finally {
    bitmap.close();
  }
}
```

- [ ] **7-5. 검증**: `npx tsc --noEmit` · `npx eslint src`. 실기능 검증은 Task 11(폼)에서 E2E로 — 단, 서빙 라우트는 지금 확인 가능: 개발 기본 폴더에 테스트 JPEG를 수동으로 두고 `/uploads/properties/...` GET 200, `/uploads/../.env` 형태가 404인지 curl로 실측.

---

## Task 8: 매물 서비스 + admin.property 라우터

**Files:** ✚ `src/server/services/property.service.ts` · ✚ `src/server/trpc/routers/admin-property.ts` · ✎ `_app.ts`

- [ ] **8-1. 서비스** — `src/server/services/property.service.ts`. 트랜잭션과 `property_logs`가 여기 산다.

```ts
import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import { properties, propertyImages, propertyLogs, propertyOptions } from "@/db/schema";
import type { PropertyStatus } from "@/lib/codes";
import type { PropertySaveInput } from "@/domain/property-schema";
import { deleteStoredImage } from "./image-storage.service";

/**
 * 매물 CRUD — 상태 변경·삭제까지 전부 property_logs를 남긴다(RULE-11).
 * 로그는 거래완료 방치 과태료의 소명자료다: "언제 누가 무엇을" 세 가지가 항상 남아야 한다.
 */

/** 스키마 입력 → properties 컬럼. numeric 컬럼은 drizzle 규약상 string */
function toPropertyColumns(input: PropertySaveInput) {
  return {
    title: input.title,
    buildingType: input.buildingType,
    dealType: input.dealType,
    status: input.status,
    salePrice: input.salePrice,
    deposit: input.deposit,
    monthlyRent: input.monthlyRent,
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
    sido: input.sido,
    sigungu: input.sigungu,
    dong: input.dong,
    bjdCode: input.bjdCode,
    jibunAddress: input.jibunAddress,
    roadAddress: input.roadAddress,
    detailAddress: input.detailAddress,
    lat: input.lat,
    lng: input.lng,
    description: input.description,
    videoUrl: input.videoUrl,
    videoDuration: input.videoDuration,
    videoSummary: input.videoSummary,
    fieldCheckedAt: input.fieldCheckedAt,
    completedAt: input.status === "COMPLETED" ? new Date() : null,
  };
}

/** 소명자료용 스냅샷 — 전체 컬럼이 아니라 분쟁에 쓰이는 핵심만 */
function buildLogSnapshot(input: PropertySaveInput) {
  return {
    title: input.title,
    dealType: input.dealType,
    status: input.status,
    salePrice: input.salePrice,
    deposit: input.deposit,
    monthlyRent: input.monthlyRent,
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
      .values(toPropertyColumns(input))
      .returning({ id: properties.id });

    if (input.optionCodes.length > 0) {
      await tx.insert(propertyOptions).values(
        input.optionCodes.map((optionCode) => ({ propertyId: inserted.id, optionCode })),
      );
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
  // 트랜잭션 밖에서 삭제할 파일 목록만 계산하고, 실제 파일 삭제는 커밋 후에 한다 —
  // 롤백됐는데 파일만 사라지는 사고를 막는다
  const orphanPaths: string[] = [];

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: properties.id, status: properties.status, completedAt: properties.completedAt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);

    await tx
      .update(properties)
      .set({
        ...toPropertyColumns(input),
        // 이미 COMPLETED였다면 완료 시각을 덮지 않는다 — 소명자료의 기준 시각 보존
        completedAt:
          input.status === "COMPLETED"
            ? (existing.status === "COMPLETED" ? existing.completedAt : new Date())
            : null,
      })
      .where(eq(properties.id, propertyId));

    // 옵션은 전체 교체(멱등) — diff보다 단순하고 21개 상한이라 비용이 없다
    await tx.delete(propertyOptions).where(eq(propertyOptions.propertyId, propertyId));
    if (input.optionCodes.length > 0) {
      await tx.insert(propertyOptions).values(
        input.optionCodes.map((optionCode) => ({ propertyId, optionCode })),
      );
    }

    // 이미지: 제출에 없는 기존 행 삭제 + 신규 삽입 + sortOrder 재부여
    const existingImages = await tx
      .select({ id: propertyImages.id, filePath: propertyImages.filePath, thumbPath: propertyImages.thumbPath })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));
    const keptIds = new Set(input.images.filter((i) => i.id !== undefined).map((i) => i.id));
    const removed = existingImages.filter((row) => !keptIds.has(row.id));
    if (removed.length > 0) {
      await tx.delete(propertyImages).where(inArray(propertyImages.id, removed.map((r) => r.id)));
      orphanPaths.push(...removed.flatMap((r) => [r.filePath, r.thumbPath]));
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
    const result = await deleteStoredImage(orphanPath);
    if (result === "failed") console.error(`이미지 파일 삭제 실패(고아 파일): ${orphanPath}`);
  }
}

export class PropertyNotFoundError extends Error {
  constructor(readonly propertyId: number) {
    super("매물을 찾을 수 없습니다.");
    this.name = "PropertyNotFoundError";
  }
}

export async function updatePropertyStatus(
  db: Db,
  adminUserId: number,
  propertyId: number,
  nextStatus: PropertyStatus,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: properties.status, completedAt: properties.completedAt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)));
    if (!existing) throw new PropertyNotFoundError(propertyId);
    if (existing.status === nextStatus) return; // no-op — 로그를 오염시키지 않는다

    await tx
      .update(properties)
      .set({
        status: nextStatus,
        // COMPLETED 진입 시각이 과태료 소명의 기준 — 이탈하면 비운다
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
      })
      .where(eq(properties.id, propertyId));
    await tx.insert(propertyLogs).values({
      propertyId,
      action: "STATUS_CHANGED",
      adminUserId,
      snapshot: { from: existing.status, to: nextStatus },
    });
  });
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
```

- [ ] **8-2. 라우터** — `src/server/trpc/routers/admin-property.ts`

```ts
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { properties, propertyImages, propertyOptions } from "@/db/schema";
import { PROPERTY_STATUS } from "@/lib/codes";
import { propertySaveSchema } from "@/domain/property-schema";
import {
  createProperty,
  PropertyNotFoundError,
  softDeleteProperty,
  updateProperty,
  updatePropertyStatus,
} from "@/server/services/property.service";

import { adminProcedure, router } from "../init";

const propertyIdInput = z.object({ propertyId: z.number().int().positive() });

/** admin.property — 유일하게 detailAddress를 응답에 실을 수 있는 라우터(RULE-11) */
export const adminPropertyRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: properties.id,
        title: properties.title,
        buildingType: properties.buildingType,
        dealType: properties.dealType,
        status: properties.status,
        salePrice: properties.salePrice,
        deposit: properties.deposit,
        monthlyRent: properties.monthlyRent,
        dong: properties.dong,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(isNull(properties.deletedAt))
      .orderBy(desc(properties.createdAt))
      .limit(100), // 단일 사무소 매물 수십 건 규모 — 페이징은 필요해질 때
  ),

  /** 수정 폼 프리필 — 이미지·옵션 포함 전체 */
  detail: adminProcedure.input(propertyIdInput).query(async ({ ctx, input }) => {
    const [property] = await ctx.db
      .select()
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)));
    if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "매물을 찾을 수 없습니다." });
    const [images, options] = await Promise.all([
      ctx.db
        .select()
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, input.propertyId))
        .orderBy(asc(propertyImages.sortOrder)),
      ctx.db
        .select({ optionCode: propertyOptions.optionCode })
        .from(propertyOptions)
        .where(eq(propertyOptions.propertyId, input.propertyId)),
    ]);
    return { property, images, optionCodes: options.map((o) => o.optionCode) };
  }),

  create: adminProcedure.input(propertySaveSchema).mutation(({ ctx, input }) =>
    createProperty(ctx.db, ctx.adminUserId, input),
  ),

  update: adminProcedure
    .input(z.object({ propertyId: z.number().int().positive(), data: propertySaveSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateProperty(ctx.db, ctx.adminUserId, input.propertyId, input.data);
      } catch (error) {
        if (error instanceof PropertyNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
      return { ok: true as const };
    }),

  updateStatus: adminProcedure
    .input(propertyIdInput.extend({ nextStatus: z.enum(PROPERTY_STATUS) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePropertyStatus(ctx.db, ctx.adminUserId, input.propertyId, input.nextStatus);
      } catch (error) {
        if (error instanceof PropertyNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
      return { ok: true as const };
    }),

  softDelete: adminProcedure.input(propertyIdInput).mutation(async ({ ctx, input }) => {
    try {
      await softDeleteProperty(ctx.db, ctx.adminUserId, input.propertyId);
    } catch (error) {
      if (error instanceof PropertyNotFoundError) {
        throw new TRPCError({ code: "NOT_FOUND", message: error.message });
      }
      throw error;
    }
    return { ok: true as const };
  }),
});
```

- [ ] **8-3. `_app.ts`의 admin 라우터에 `property: adminPropertyRouter` 추가**

- [ ] **8-4. 검증**: `npx tsc --noEmit` · `npx eslint src` · `npx vitest run` 전부 통과. 기능 검증은 Task 11 E2E에서.

---

## Task 9: 공개 property 라우터

**Files:** ✚ `src/server/trpc/routers/property.ts` · ✎ `_app.ts`

- [ ] **9-1. 라우터** — **detailAddress를 select 자체에서 제외**한다(응답 후 strip이 아니라 쿼리에서 안 뽑는다 — 누락 실수가 타입으로 잡힌다).

```ts
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { properties, propertyImages, propertyOptions } from "@/db/schema";

import { publicProcedure, router } from "../init";

/**
 * 공개 매물 조회. **detailAddress는 select 목록에 아예 없다** (RULE-11) —
 * 응답 가공에서 빼는 방식은 컬럼 추가·리팩토링 때 조용히 새기 쉽다.
 * 노출 대상: ACTIVE(거래중) + COMPLETED(거래완료 표시용). HIDDEN·삭제는 404.
 */

/** 공개 응답에 실어도 되는 컬럼만 — 여기 없는 컬럼은 공개면에 존재하지 않는 것과 같다 */
const publicPropertyColumns = {
  id: properties.id,
  title: properties.title,
  buildingType: properties.buildingType,
  dealType: properties.dealType,
  status: properties.status,
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

const publicVisible = [
  isNull(properties.deletedAt),
  inArray(properties.status, ["ACTIVE", "COMPLETED"]),
] as const;

export const propertyRouter = router({
  detail: publicProcedure
    .input(z.object({ propertyId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select(publicPropertyColumns)
        .from(properties)
        .where(and(eq(properties.id, input.propertyId), ...publicVisible));
      if (!property) throw new TRPCError({ code: "NOT_FOUND", message: "매물을 찾을 수 없습니다." });

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

      // 조회수 — 실패해도 상세는 떠야 한다
      try {
        await ctx.db
          .update(properties)
          .set({ viewCount: sql`${properties.viewCount} + 1` })
          .where(eq(properties.id, input.propertyId));
      } catch (viewCountError) {
        console.error("viewCount 증가 실패:", viewCountError);
      }

      return { property, images, optionCodes: options.map((o) => o.optionCode) };
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
            eq(properties.status, "ACTIVE"),
            isNull(properties.deletedAt),
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
```

- [ ] **9-2. `_app.ts`에 `property: propertyRouter` 등록** (최상위, admin 밖)

- [ ] **9-3. 검증**: `npx tsc --noEmit`. dev 서버에서 curl 실측 —

```bash
curl -s "http://localhost:3000/api/trpc/property.detail?input=%7B%22json%22%3A%7B%22propertyId%22%3A1%7D%7D" | grep -c detailAddress
```

매물이 아직 없으면 NOT_FOUND면 정상. Task 11 후 재실측해 **0**(detailAddress 문자열 부재) 확인 — 이것이 인수인계 문서의 검증 항목이다.

---

## Task 10: 관리자 셸 — 로그인·레이아웃·목록

**Files:** ✚ `src/app/admin/layout.tsx` · ✚ `src/app/admin/login/page.tsx` · ✚ `src/app/admin/(authed)/layout.tsx` · ✚ `src/app/admin/(authed)/page.tsx` · ✚ `src/app/admin/(authed)/properties/page.tsx`

UI 태스크(10·11·12)는 마크업 전문 대신 **구현 명세**로 적는다 — 스타일은 기존 토큰(`bg-surface-alt`, `text-ink`, `rounded-md` 등)만 쓰고, 구조·동작·분기가 명세와 다르면 계획 위반이다.

- [ ] **10-1. `admin/layout.tsx`** — 서버 컴포넌트. `export const metadata = { robots: { index: false, follow: false } }` + children 패스스루. (SPEC: `/admin/**` noindex)

- [ ] **10-2. `admin/login/page.tsx`** — `"use client"`. loginId/password 2필드 + 제출 버튼. `useTRPC()` + `useMutation(trpc.admin.auth.login.mutationOptions())` 패턴(기존 `page.tsx`의 health 호출 방식 참조). 성공 → `router.replace("/admin/properties")`. 실패 → mutation error message를 폼 아래 `text-alert`로. 제출 중 버튼 disabled. 라벨 있는 input(아이콘만 금지 — RULE-11 접근성), 터치 타깃 44px.

- [ ] **10-3. `admin/(authed)/layout.tsx`** — 서버 컴포넌트. `await readAdminSessionUserId()` → null이면 `redirect("/admin/login")` (next/navigation). 통과 시 상단 헤더: "oh4989 관리자" · "매물 관리" 링크 · 로그아웃 버튼(클라 컴포넌트 — `admin.auth.logout` mutation 후 `router.replace("/admin/login")`). 로그인 페이지가 그룹 **밖**에 있으므로 리다이렉트 루프가 없다.

- [ ] **10-4. `admin/(authed)/page.tsx`** — `redirect("/admin/properties")` 한 줄.

- [ ] **10-5. `admin/(authed)/properties/page.tsx`** — `"use client"` (SPEC: admin은 CSR). `admin.property.list` useQuery. 테이블: 제목(수정 링크) / 유형(BUILDING_TYPE_LABEL·DEAL_TYPE_LABEL) / 가격(`formatPropertyPrice`) / 상태(PROPERTY_STATUS_LABEL 배지 — COMPLETED는 색+텍스트, HIDDEN은 회색) / 등록일. 행별 액션: 상태 변경 select(즉시 `updateStatus` mutation + invalidate) · 삭제 버튼(confirm 후 `softDelete`) · 공개 상세 링크(`/properties/{id}`, 새 탭). 상단 "새 매물 등록" 버튼 → `/admin/properties/new`. 빈 목록 상태 문구 포함.

- [ ] **10-6. 검증**: 로그인 → 목록 진입, 비로그인 시 `/admin/properties` 직접 접근이 로그인으로 리다이렉트되는지, 로그아웃 후 재접근 차단, `npx tsc --noEmit` · `npx eslint src`. 브라우저 preview로 실측.

---

## Task 11: 매물 등록·수정 폼

**Files:** ✚ `src/app/admin/_components/PropertyForm.tsx` · ✚ `ImageUploader.tsx` · ✚ `MaintenanceFeeEditor.tsx` · ✚ `admin/(authed)/properties/new/page.tsx` · ✚ `admin/(authed)/properties/[id]/edit/page.tsx`

- [ ] **11-1. `PropertyForm.tsx`** — `"use client"`. 내부 상태는 `PropertySaveInput`과 같은 형태의 단일 객체(useState). 섹션 구조와 동적 분기:

| 섹션 | 필드 | 동적 규칙 |
|---|---|---|
| 기본 | title, buildingType(select), dealType(select), status(select: 거래중/거래완료/숨김) | — |
| 가격 | salePrice / deposit / monthlyRent (만원 단위 숫자 input) | SALE→salePrice만, JEONSE→deposit만, MONTHLY·SHORT→deposit+monthlyRent 표시 |
| 면적·층 | exclusiveArea, supplyArea, floor, totalFloor, floorDisplay(라디오: 정확히/저·중·고) | `FLOOR_RULE_BY_BUILDING_TYPE`: TOTAL_ONLY→floor·floorDisplay 숨김, EXACT_STRICT→floorDisplay 숨김(EXACT 고정) |
| 상세 스펙 | roomCount, bathCount, direction(select+DIRECTION_LABEL), directionBase, moveInDate, approvalDate(date), parkingTotal, parkingPerUnit, buildingUse | 비주거형(STORE·OFFICE·LAND — `isResidential`)이면 방/욕실/방향 섹션에 "선택 입력" 표시 |
| 관리비 | maintenanceFee(총액) + `MaintenanceFeeEditor` | — |
| 주소 | sido, sigungu, dong, bjdCode, jibunAddress, roadAddress, detailAddress | detailAddress 옆 "⚠️ 공개 화면에는 절대 표시되지 않습니다" 안내 |
| 좌표 | lat, lng (숫자 input) | 도움말: "카카오맵에서 위치 우클릭 → '좌표 복사'" |
| 콘텐츠 | description(textarea), videoUrl, videoDuration, videoSummary, fieldCheckedAt(date) | — |
| 옵션 | PROPERTY_OPTIONS 21개 체크박스 그리드(라벨 = PROPERTY_OPTION_LABEL) | — |
| 사진 | `ImageUploader` | — |

제출: `propertySaveSchema.safeParse` → 실패 시 필드별 에러 표시(zod issue path 매핑) + 첫 에러로 스크롤. 성공 시 create 또는 update mutation → 목록으로 이동. **status를 ACTIVE로 저장할 때 법정 필수 검증이 걸리는 것**이 §8 요건의 구현이다. 빈 문자열 input은 null로 정규화해서 스키마에 넘긴다(숫자 필드는 `Number()` 변환 — NaN이면 null).

- [ ] **11-2. `ImageUploader.tsx`** — `"use client"`. `input[type=file][multiple][accept=image/*]` → 파일별 `createPropertyImagePair` → FormData(`detail`/`thumb` 쌍) → `fetch("/api/admin/property-images", { method: "POST", body })` → 응답 경로를 value 배열(`{id?, filePath, thumbPath}[]`)에 append. 그리드 표시(`/uploads/{thumbPath}`), 0번에 "대표" 배지(sortOrder=0 규약), 카드마다 ↑/↓ 순서 버튼·삭제 버튼(라벨 병기). 업로드 중 스피너·실패 메시지. props: `value` / `onChange` (제어 컴포넌트 — 폼이 소유).

- [ ] **11-3. `MaintenanceFeeEditor.tsx`** — `"use client"`. MAINTENANCE_GROUPS 3구분(라벨 = MAINTENANCE_GROUP_LABEL) 각각에 `{item, amount}` 행 추가/삭제. 값이 하나도 없으면 `maintenanceDetail: null`. props: `value` / `onChange`.

- [ ] **11-4. `new/page.tsx`** — `<PropertyForm mode="create" />`. **`edit/page.tsx`** — `"use client"`, `admin.property.detail` useQuery → 로딩 후 `<PropertyForm mode="edit" propertyId initialValue />`. DB 행 → 폼 값 매핑: numeric string은 `Number()`, `approvalDate`·`fieldCheckedAt`은 date 컬럼이라 문자열 그대로, images는 `{id, filePath, thumbPath}`로.

- [ ] **11-5. E2E 검증 (브라우저 preview 실측)**:
  1. 아파트 전세 매물을 사진 2장과 함께 ACTIVE로 등록 → 목록에 표시
  2. 업로드 폴더에 `{hex}.jpg`+`{hex}-thumb.jpg` 쌍 생성 확인, **원본과 다른 파일 크기**(재인코딩 증거) 확인
  3. 필수 누락(가격 없이 ACTIVE) → 저장 차단 + 에러 표시. 같은 입력을 HIDDEN으로 → 저장 성공
  4. 상가 매물에서 floorDisplay UI가 숨는지, 단독에서 floor 입력이 숨는지
  5. 수정: 사진 순서 변경·1장 삭제 → 저장 → 삭제된 파일이 디스크에서 사라졌는지
  6. `npx tsc --noEmit` · `npx eslint src` · `npx vitest run`

---

## Task 12: 공개 매물 상세 페이지

**Files:** ✚ `src/app/properties/[id]/page.tsx` · ✚ `src/app/properties/[id]/PhotoCarousel.tsx` · ✚ `src/server/services/site-settings.service.ts`

**착수 전:** `C:\_Hope\Ohsite\_핸드오프\확정안_프로토타입.html`을 브라우저(preview)로 열어 상세 화면의 실제 모양(블록 간격·배지·표 스타일)을 확인하고 재구현한다. 복사 금지(17MB 번들, CLAUDE.md).

- [ ] **12-1. `site-settings.service.ts`** — `settingKey = 'officeInfo'` 단건 조회. 형태:

```ts
import "server-only";

import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { siteSettings } from "@/db/schema";

/** 중개사무소 법정정보 (리스킨 교체 지점 — 하드코딩 금지, RULE-11) */
export type OfficeInfo = {
  officeName: string;
  officeAddress: string;
  officePhone: string;
  registrationNumber: string;
  ownerName: string; // 개업공인중개사 성명. ⚠️ 중개보조원 정보는 어떤 필드로도 만들지 않는다
};

export async function getOfficeInfo(db: Db): Promise<OfficeInfo | null> {
  const [row] = await db
    .select({ settingValue: siteSettings.settingValue })
    .from(siteSettings)
    .where(eq(siteSettings.settingKey, "officeInfo"));
  return (row?.settingValue as OfficeInfo) ?? null;
}
```

사용자에게 전달할 INSERT 템플릿(U5 — 법정정보 확보 후):

```sql
INSERT INTO site_settings (setting_key, setting_value) VALUES (
  'officeInfo',
  '{"officeName":"<상호>","officeAddress":"<소재지>","officePhone":"<전화>","registrationNumber":"<등록번호>","ownerName":"<대표 성명>"}'
) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

- [ ] **12-2. `page.tsx`** — 서버 컴포넌트, **동적 렌더**(§0 결정). tRPC는 HTTP 왕복 없이 서버 caller로: `createCallerFactory(appRouter)`로 caller 생성 헬퍼를 `src/server/trpc/caller.ts`에 추가(컨텍스트는 `headers()`로 구성 — 기존 `createTRPCContext` 재사용). `property.detail` NOT_FOUND → `notFound()`. `generateMetadata`: `{제목} | {officeInfo.officeName ?? "oh4989"}` + description(동·유형·가격 요약).

블록 순서 — **§4-P3 그대로, 순서 변경 금지**:

| # | 블록 | 구현 |
|---|---|---|
| 1 | 사진 캐러셀 | `PhotoCarousel`(클라): 16:9, CSS scroll-snap 가로 스크롤 + 하단 인디케이터 도트 + "n/총" 카운터. 사진 없으면 `bg-surface-alt` 플레이스홀더. 전체화면 갤러리는 Phase 3 |
| 2 | 배지·가격 | `DEAL_TYPE_LABEL` 배지(`bg-accent-soft text-accent`) + `formatPropertyPrice` (`num` 유틸리티 클래스, 최대 타입). **COMPLETED면 "거래완료" 배지(`bg-ink-40`) + 가격 취소선** — 색+텍스트 병행(RULE-11) |
| 3 | 제목·주소 | title 한 줄 + `{sido} {sigungu} {dong}` — **동 단위까지만** |
| 4 | 핵심 스펙 4칸 | 면적 `formatArea(exclusiveArea)` / 층 `formatFloor(...)` / 방·욕실 `방3 · 욕실2`(비주거형은 "-") / 방향 `남향 (안방 기준)` = `DIRECTION_LABEL[direction]` + directionBase |
| 5 | 관리비 | `formatMaintenanceFee(maintenanceFee)` + maintenanceDetail이 있으면 3구분 그룹별(`MAINTENANCE_GROUP_LABEL`) 항목·금액 목록 |
| 6 | 매물 특징 | description (whitespace-pre-wrap). 비어 있으면 블록 생략 |
| 6.5 | 영상 (videoUrl 있을 때만) | YouTube 임베드 iframe(자동재생 금지, §5-7) + videoSummary 병기 |
| 7 | 법정 명시항목 표 | §8 표 항목 전부 2열 표: 소재지(동까지) / 면적(전용·공급) / 층(`formatFloor`) / 건축물 용도 / 방향 / 방·욕실 / 입주가능일 / 행정기관 승인일자 / 주차(총 n대·세대당 n대) / 관리비 총액. 값 없는 항목은 "-" |
| 8 | 위치 | 지도는 Phase 2 — `bg-surface-alt` 박스에 "🗺 {dong} (지도는 준비 중입니다)" + fieldCheckedAt 있으면 "현장 확인 {날짜}" 배지 |
| 9 | 중개사무소 정보 | `getOfficeInfo` — 있으면 명칭/소재지/등록번호/대표/연락처 전부, null이면 "중개사무소 정보 준비 중" |
| 10 | 같은 지역 다른 매물 | `property.related` — 썸네일+제목+가격 카드 3개, 없으면 블록 생략 |
| CTA | 하단 고정 바 | `[문의하기(비활성 — Phase 3)] [☎ 전화]` — 전화가 가장 강한 버튼(`bg-accent text-white`), `tel:{officePhone}`. officeInfo 없으면 바 자체 생략. [관심]은 Phase 3(localStorage) |

- [ ] **12-3. 모바일 우선 + PC 2단**: 본문 max-w 제한, PC(`lg:`)에서 캐러셀·특징 좌열 / 스펙·법정 표 우열 2단. 터치 타깃 44px, 아이콘만 버튼 금지.

- [ ] **12-4. 검증 (브라우저 preview 실측)**:
  1. 등록한 매물 상세 200 + 블록 순서 일치 (모바일 375px + PC 1280px 스크린샷)
  2. 층 표기 3분기: 아파트(`3/15층`)·단독(`총 2층`)·상가(`2/5층`) 3건 등록해 실측
  3. HIDDEN 매물 → 404. COMPLETED → 거래완료 표시 + 취소선
  4. `detailAddress` 부재 실측: `curl -s <상세 tRPC URL> | grep -c detailAddress` → **0**
  5. 페이지 소스에 EXIF 관련 없음 — 업로드 사진 파일을 exiftool 대신 브라우저로 열어 좌표 메타 부재 확인(Canvas 재인코딩이면 자동 충족, 파일 크기 변화로 갈음)

---

## Task 13: 통합 검증 · 배포 · 마무리

- [ ] **13-1. 전체 게이트**: `npx vitest run` · `npx tsc --noEmit` · `npx eslint src` 전부 통과 + `npm run build` 성공(로컬 — 서버 빌드 금지)
- [ ] **13-2. 인수인계 문서의 검증 표 재확인**: 인증 경계(비로그인 403/로그인 200) · detailAddress 부재 · 층 3분기 — 전부 실측 완료 상태인지
- [ ] **13-3. 임시 산출물 점검(RULE-13)**: 테스트로 등록한 더미 매물 삭제(soft delete면 충분), 업로드 테스트 파일 정리, 스크래치 파일 정리
- [ ] **13-4. 사용자 확인 요청** — 변경 요약·이슈 보고 후 승인 대기 (RULE-4)
- [ ] **13-5. (승인 후) 배포**: 사용자 U4(서버 env에 SESSION_SECRET) 완료 확인 → `npm run deploy` → `https://oh4989.com/api/trpc/health.ping` 200 + 운영에서 로그인·등록·상세 1회 실측. 실패 시 서버에서 `./deploy.sh rollback`
- [ ] **13-6. 작업로그 append** (`작업로그_oh4989_20260806.md`) + 계획 문서 status를 `완료`로 갱신 + MEMORY.md 갱신
- [ ] **13-7. 실사용 검수 안내**: SPEC §8 "실제 매물 3~5건" — 사용자가 실매물 데이터로 등록·검수 (Phase 1 완료 판정)

---

## 검증 매트릭스 (인수인계 문서 §검증 방법 대응)

| 대상 | 방법 | 태스크 |
|---|---|---|
| 타입·린트 | `npx tsc --noEmit` · `npx eslint src` | 매 태스크 |
| 도메인 로직 | vitest (price·floor·area·schema) | T2~4 |
| 인증 경계 | adminPing 비로그인 403 / 로그인 200 실측 | T6 |
| detailAddress 비공개 | 공개 상세 tRPC 응답 curl grep → 0건 | T9·T12 |
| 법정 층 표기 | 단독/아파트/상가 3건 실측 | T12 |
| EXIF 제거 | Canvas 재인코딩 경유 확인(파일 크기 변화) | T11 |
| 실사용 | 실매물 3~5건 등록 검수 | T13 (사용자) |

## 알려진 한계 (Phase 넘김 — 스코프 아님을 명시)

- 전체화면 갤러리·PDF 인쇄·[관심] 버튼·문의 폼 → Phase 3
- 지도 블록·주소 검색·좌표 자동 채움 → Phase 2 (카카오 키)
- ISR + on-demand revalidate·JSON-LD·OG → Phase 4
- 자동등록(텍스트 파서) → Phase 4 (신규 개발로 확정됨)
- LAND(토지) 매물의 법정 필수 규칙은 주거형 기준을 준용 — 주력 유형 확정(§부록) 후 재검토
- 업로드 후 폼 미저장 이탈 시 고아 파일 가능 — property_images에 없는 파일을 찾는 정리 스크립트는 운영 데이터가 쌓이면 추가
