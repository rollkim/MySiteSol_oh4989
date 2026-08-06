# oh4989.com 개발 핸드오프 스펙 v1

> **대상**: Claude Code. 이 문서를 프로젝트 루트에 `SPEC.md`로 두고, 함께 제공되는 `부동산사이트_디자인가이드_v1.md`를 디자인의 단일 기준(source of truth)으로 삼는다.
> **작성일**: 2026-08-05
> **성격**: 오채영부동산(배곧) 지도형 매물 사이트. 명율(myoungyul.com) 코드베이스를 참조·이식하는 신규 구축.

---

## 0. 확정 사항 (변경 금지)

| 항목 | 확정값 |
|---|---|
| 도메인 | `oh4989.com` (canonical, OG, sitemap 모두 이 기준) |
| 회원 | **비회원 전용.** 공개 화면 어디에도 로그인/가입 UI 없음. 관리자는 `/admin` 직접 접근 |
| 컬러 | 네이비 톤 (디자인 가이드 §5-2 토큰 값 그대로) |
| 지도 | 카카오맵 웹 JS SDK |
| 동영상 | YouTube 일부공개(Unlisted) 임베드. 자체 서버 영상 저장 금지 |
| 매물 탐색 | 지도형(메인) + 목록형 병행 |
| 외부 매물 크롤링 | **금지** (법적 리스크. 자체 등록만) |

---

## 1. 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 16.x (App Router)** | standalone 빌드 |
| 런타임 | Node.js 22 LTS | |
| API | **tRPC 11** + `@trpc/tanstack-react-query` | 핸들러: `app/api/trpc/[trpc]/route.ts` |
| ORM | **Drizzle** (`drizzle-orm/mysql2`) | 마이그레이션은 `drizzle-kit generate` → SQL 리뷰 → `migrate`. **`push` 프로덕션 금지** |
| DB | MariaDB (utf8mb4) | |
| 스타일 | Tailwind CSS v4 | 디자인 토큰은 CSS 변수로 선언 후 Tailwind에서 참조 |
| 지도 | 카카오맵 JS SDK (+ `react-kakao-maps-sdk` 검토, 직접 래핑도 허용) | `next/dynamic({ ssr: false })` 필수 |
| 이미지 | sharp 리사이즈 → 서버 로컬 저장 | 명율 파이프라인 이식 |
| 통계 | GA4 | 명율 연동 코드 이식, 관리자 트래픽 제외 포함 |
| 배포 | Ubuntu VPS + Nginx + PM2 + Let's Encrypt | `output: 'standalone'` |

### 명율에서 이식하는 것 / 버리는 것

**이식 (참조 리포: 명율)**
- 관리자 자동매물등록 로직 (텍스트 붙여넣기 → 필드 파싱)
- 이미지 리사이즈/EXIF 제거 파이프라인
- tRPC public / protected / admin 미들웨어 구조
- GA4 연동 (서비스 계정, 관리자 제외)
- Nginx + PM2 배포 구성 스크립트

**버림**
- Puppeteer prerender 미들웨어 (Next.js SSR로 대체)
- react-helmet-async (Next Metadata API로 대체)
- Cloudflare R2 (로컬 SSD 저장으로 대체)
- 한글 컬럼·한글 코드값 스키마 (아래 §3 신규 스키마로 대체)
- JWT 회원 인증 플로우 (관리자 세션만 남김)

---

## 2. 라우트 맵

```
/                       홈 (세로 영상 레일 + 지도 프리뷰 + 추천 매물)      ISR 10분
/map                    지도 검색 (PC 3분할 / 모바일 바텀시트)            CSR (지도부만)
/properties             목록형 매물 (필터, SEO 랜딩)                     SSR
/properties/[id]        매물 상세                                       ISR + on-demand revalidate
/areas/[slug]           지역별 안내 (배곧동 등)                          ISR
/favorites              관심 매물 (localStorage)                        CSR
/inquiry                문의 폼                                         SSR
/request                매물 등록 의뢰 (집주인용)                        SSR
/about                  중개사무소 소개                                  SSG
/admin/**               관리자 (로그인, 대시보드, 매물, 자동등록, 문의, 설정)  CSR, noindex
```

- 매물 상세는 반드시 독립 URL — 블로그 링크·카톡 공유·색인의 단위
- 관리자 매물 저장/상태변경 시 해당 상세와 `/map` 데이터 revalidate
- `robots.txt`: `/admin` Disallow. `sitemap.xml`: 정적 라우트 + 공개중 매물 전체

### SEO 필수 구현
- `metadataBase: new URL('https://oh4989.com')`
- 매물 상세: 페이지별 self-canonical, OG 이미지(대표 사진), `RealEstateListing` + `Offer` JSON-LD
- 사무소: `LocalBusiness`(등록번호·주소·전화) JSON-LD — 푸터 아닌 `/about` 기준
- 네이버 서치어드바이저 + 구글 서치콘솔 소유확인 메타 자리 환경변수화

---

## 3. DB 스키마 (Drizzle)

명율의 한글 컬럼·한글 코드값은 **계승하지 않는다.** 코드값은 영문 코드 문자열 + TS 상수(`as const`)로 관리. DB ENUM 사용 금지(ALTER 잠금 회피).

```ts
// 코드값 — src/lib/codes.ts (전 계층에서 이 상수만 참조)
export const DEAL_TYPES = ['SALE', 'JEONSE', 'MONTHLY', 'SHORT'] as const;
export const BUILDING_TYPES = [
  'APT', 'OFFICETEL', 'VILLA',        // 아파트, 오피스텔, 빌라·다세대
  'ONE_ROOM', 'TWO_ROOM', 'URBAN',    // 원룸, 투룸, 도시형생활주택
  'DETACHED', 'STORE', 'OFFICE',      // 단독·다가구, 상가, 사무실
  'LAND',                             // 토지
] as const;
export const DIRECTIONS = ['E','W','S','N','SE','SW','NE','NW'] as const;
export const PROPERTY_STATUS = ['ACTIVE', 'COMPLETED', 'HIDDEN'] as const;
export const FLOOR_DISPLAY = ['EXACT', 'LOW_MID_HIGH'] as const; // 층 표기 방식
```

```ts
// 테이블 골격 (필드명·타입 기준. 세부 length는 구현 시 판단)
properties {
  id                bigint PK autoincrement
  title             varchar(100)
  buildingType      varchar(20)        // BUILDING_TYPES
  dealType          varchar(20)        // DEAL_TYPES
  status            varchar(20) default 'ACTIVE'
  // 가격 (만원 단위 정수)
  salePrice         int null           // 매매가
  deposit           int null           // 보증금/전세금
  monthlyRent       int null          
  // 면적 (㎡, 소수1자리)
  exclusiveArea     decimal(7,1)       // 전용 — 법정 필수
  supplyArea        decimal(7,1) null  // 공급
  // 층 — 법정: 유형별 표기 분기
  floor             smallint null      // 해당 층 (단독주택은 null 허용)
  totalFloor        smallint
  floorDisplay      varchar(20) default 'EXACT'  // 저/중/고 대체 여부
  // 법정 명시항목
  roomCount         tinyint null
  bathCount         tinyint null
  direction         varchar(4) null    // DIRECTIONS
  directionBase     varchar(20) null   // '안방', '거실' 등 기준
  moveInDate        varchar(20) null   // '즉시입주' 또는 날짜 문자열
  approvalDate      date null          // 사용승인일
  parkingTotal      smallint null
  parkingPerUnit    decimal(3,1) null
  buildingUse       varchar(50) null   // 건축물 용도
  // 관리비 — 3구분 의무 대응
  maintenanceFee    int null           // 총액 (만원)
  maintenanceDetail json null          // {general:[], usage:[], etc:[]} 각 {item, amount}
  // 주소
  sido / sigungu / dong  varchar
  bjdCode           char(10)           // 법정동코드
  jibunAddress      varchar(200)
  roadAddress       varchar(200) null
  detailAddress     varchar(100) null  // 비공개 — 응답에서 항상 제외
  lat / lng         decimal(10,7)      // 복합 인덱스 (lat, lng)
  // 콘텐츠
  description       text
  videoUrl          varchar(300) null  // YouTube URL
  videoDuration     varchar(10) null   // '0:48'
  fieldCheckedAt    date null          // 현장 확인일
  // 메타
  viewCount         int default 0
  createdAt / updatedAt / completedAt / deletedAt
}

property_images { id, propertyId FK, filePath, thumbPath, sortOrder, isMain }
property_options { propertyId FK, optionCode varchar(30) }   // AIRCON, FRIDGE, WASHER, ...
inquiries { id, propertyId FK null, name, phone, message, status, adminMemo, createdAt }
owner_requests { id, name, phone, addressHint, dealType, message, status, createdAt }  // 매물 등록 의뢰
site_settings { key PK, value json }   // 사무소 법정정보, 초기 지도 좌표 등
admin_users { id, loginId, passwordHash, lastLoginAt }       // 1~2계정, bcrypt
property_logs { id, propertyId, action, snapshot json, createdAt }  // 상태변경 이력 — 과태료 소명자료
```

**규칙**
- `detailAddress`는 tRPC 응답 직렬화에서 항상 strip (admin 라우터 제외)
- 상태 변경(특히 `COMPLETED`)은 반드시 `property_logs`에 기록 — 거래완료 방치 과태료 소명자료
- `completedAt` 설정 시 지도·목록·상세 즉시 반영 (revalidate)

---

## 4. tRPC 라우터 설계

```
appRouter
├─ property (public)
│   ├─ mapSearch      input: bounds{sw,ne} + zoom + filters → 줌 낮으면 동별 집계, 높으면 개별 마커
│   ├─ list           input: filters + cursor (무한스크롤)
│   ├─ detail         input: id → detailAddress 제외 응답
│   └─ related        input: id → 같은 동 3건
├─ inquiry (public)   create — rate limit (IP당 시간당 5회)
├─ ownerRequest (public) create
└─ admin (protected: 세션 쿠키 미들웨어)
    ├─ auth.login / logout
    ├─ property.create / update / updateStatus / delete / autoRegister(파싱)
    ├─ image.upload / reorder / setMain / delete
    ├─ inquiry.list / updateStatus / memo
    └─ settings.get / update
```

**mapSearch 성능 규칙**
- bounds 기반 `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?` + status='ACTIVE'
- 줌 레벨 임계값 이하 → `GROUP BY dong` 집계(count, 대표좌표)만 반환
- 응답 상한 200건, 초과 시 count와 함께 "더 확대" 신호
- 지도 idle 이벤트 debounce 300ms

---

## 5. 화면 구현 명세

디자인 가이드가 기준. 여기서는 동작 규칙만 보강한다.

### /map (핵심 화면)
- **PC**: 좌 리스트(360px) / 중 상세(580px) / 우 지도 3분할. 리스트 hover ↔ 마커 강조 양방향 연동. 지도 이동 시 자동 재검색 금지, "이 지역 재검색" 버튼 노출
- **모바일**: 지도 전면 + 바텀시트 3단 스냅(72px / 45vh / 90vh). 마커 탭 → 미리보기 카드(바텀시트와 별개 레이어). 상세 진입은 `/properties/[id]` 라우트 전환, 뒤로가기 시 지도 상태(중심·줌·필터) 복원 — URL 쿼리 or sessionStorage
- 마커: 디자인 가이드 §5-5 형태 명세(유형별 모양 구분). 카카오맵 CustomOverlay로 구현. 영상 보유 매물 ▶ 도트
- 필터: 거래유형 / 가격 범위 / 면적 / 방 수 / 옵션. URL 쿼리 동기화 (공유 가능)

### /properties/[id]
- 디자인 가이드 §4-P3 블록 순서 그대로
- **법정 명시항목 표**: §8 항목 전부. 건물유형별 층 표기 분기(단독=총층만, 상가=저/중/고 대체 불가)
- 관리비 3구분 블록: `maintenanceDetail` JSON 렌더
- 하단 고정 CTA: [관심] [문의하기] [☎ 전화(tel:)]
- 사진 캐러셀 + 전체화면 갤러리, 영상 블록(YouTube 임베드, 자동재생 금지, 자막 요약 병기)
- PC 한정: 매물 안내서 인쇄 버튼 (`window.print()` + `@media print` — 명율 방식)

### /admin/properties/new (자동등록 포함)
- 건물유형 선택 → **법정 필수항목 동적 변경** (단독주택이면 해당층 입력 숨김 등)
- 자동등록 탭: 매물 텍스트 붙여넣기 → 파싱 → 폼 프리필 → 검수 후 저장 (명율 로직 이식)
- 주소 입력: 도로명주소 검색 팝업 → 좌표 자동 채움(카카오 로컬 API) → 지도에서 핀 미세조정
- 이미지: 드래그 업로드 → sharp 리사이즈(원본/상세/썸네일 3종) → 로컬 저장
- 저장 전 검증: 법정 필수항목 누락 시 저장 차단 + 항목별 안내

---

## 6. 환경변수

```
DATABASE_URL=
SESSION_SECRET=
NEXT_PUBLIC_KAKAO_MAP_KEY=          # 카카오 developers JS 키
KAKAO_REST_KEY=                     # 지오코딩용 REST 키
NEXT_PUBLIC_GA_ID=
GA_SERVICE_ACCOUNT_JSON=            # 관리자 대시보드 통계용
NEXT_PUBLIC_SITE_URL=https://oh4989.com
UPLOAD_DIR=/var/www/oh4989/uploads
NAVER_SITE_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
```

---

## 7. 배포

```
# 빌드
next.config: output 'standalone'
pm2 ecosystem: oh4989 → node .next/standalone/server.js, PORT=3100
pm2 startup + pm2 save

# Nginx
server_name oh4989.com www.oh4989.com;
www → non-www 301
/_next/static → alias 캐시 (immutable, 1y)
/uploads → alias, 캐시 30d
proxy_pass → 127.0.0.1:3100
certbot --nginx -d oh4989.com -d www.oh4989.com

# 백업 (명율 방식)
cron: mysqldump 일 1회 + uploads rsync — 관리자 다운로드 가능 경로
```

---

## 8. 마일스톤

| Phase | 범위 | 완료 기준 |
|---|---|---|
| **1. 골격** | 프로젝트 셋업, 스키마+마이그레이션, tRPC 구조, 관리자 로그인, 매물 CRUD+이미지 | 관리자가 매물 1건을 등록하면 상세 페이지가 뜬다 |
| **2. 지도** | /map PC+모바일, mapSearch, 마커/클러스터, 필터, 바텀시트 | 실기기(모바일)에서 지도 탐색→상세→복귀가 매끄럽다 |
| **3. 공개면 완성** | 홈, 목록, 문의, 등록의뢰, 소개, 관심, 영상 블록 | 전 화면 반응형 + 법정 명시항목 검증 통과 |
| **4. 운영 준비** | 자동등록 이식, SEO(JSON-LD, sitemap), GA4, 배포, 서치콘솔/어드바이저 등록 | 프로덕션 도메인에서 Lighthouse SEO 90+, 매물 색인 확인 |

각 Phase 완료 시 실제 매물 데이터 3~5건으로 검수. 더미 데이터로만 검수하지 말 것 (한국식 가격 표기 `4억 3,000`, `월세 500/45` 렌더 확인 필수).

---

## 9. 금지 사항 (재확인)

- 공개 화면에 로그인·회원가입 UI 생성 금지
- 외부 플랫폼(네이버부동산·직방 등) 매물 크롤링 코드 작성 금지
- `detailAddress` 공개 API 응답 포함 금지
- localStorage 외 브라우저 저장소로 개인정보 저장 금지 (관심 매물은 매물 ID 배열만)
- 지도 컴포넌트 서버 렌더 시도 금지 (`ssr: false` 유지)
- 과장 문구("최저가", "급매 확실") 기본 문안 사용 금지 — 부당 표시·광고 해당

---

## 10. 착수 전 확보 필요 (블로커)

| # | 항목 | 없으면 막히는 것 | 담당 |
|---|---|---|---|
| 1 | **카카오 developers 앱 키** (JS + REST) | Phase 2 전체 | 개발자 생성. ⚠️ 2026.7.21부터 계정당 첫 앱만 무료 — 기존 계정에 이미 활성 앱 있으면 과금 확인 |
| 2 | **사무소 법정 정보** — 정확한 상호, 등록번호, 소재지, 대표 성명, 신고된 연락처 | 푸터·상세·JSON-LD, 법정 표기 | 사장님 |
| 3 | **주력 매물 유형 확정** — 배곧이면 아파트·오피스텔 중심 추정이나 확인 필요 | 마커 세트, 필터 기본값, 홈 구성 | 사장님 |
| 4 | **로고/CI 유무** | 헤더, OG 이미지, 파비콘 | 사장님 (없으면 워드마크 제작 포함) |
| 5 | 초기 지도 중심 좌표·줌 (배곧 기준 추정값으로 시작 가능) | /map 초기 화면 | 개발자 |
| 6 | 명율 리포 접근 경로 | 이식 작업 전반 | 개발자 |
| 7 | VPS 사양·접속 정보 | Phase 4 | 개발자 |
| 8 | 도메인 `oh4989.com` 등록 완료 + DNS 권한 | Phase 4 | 사장님 or 개발자 대행 |
| 9 | 블로그 대표 포스트 스크린샷 (톤 반영용) | 디자인 디테일 | 사장님 |
| 10 | 유튜브 채널 유무 (영상 업로드 계정) | 영상 기능 실사용 | 사장님 |

1~3번 없이는 Phase 1도 반쪽이다. 나머지는 병행 확보 가능.
