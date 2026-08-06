# oh4989

오채영부동산(시흥 배곧) 지도형 매물 사이트. `oh4989.com`

## 시작

```
npm install
npm run dev
```

`.env.example`을 `.env.local`로 복사해 값을 채운다. DB는 SSH 터널 경유로 접속한다:

```
ssh -L 15432:127.0.0.1:5432 oh4989@1.234.79.54
```

## 주의

- **빌드는 로컬에서만.** 서버(RAM 2GB)에서 `next build`를 돌리지 않는다. `standalone` 산출물만 tar로 반출한다.
- **DB 직접 접속·SQL 실행 금지** (에이전트 규칙). 마이그레이션 SQL은 사람이 실행한다.
- 지도 컴포넌트는 `next/dynamic({ ssr: false })` 고정.

## 문서

| | |
|---|---|
| 에이전트 규칙 | [CLAUDE.md](CLAUDE.md) · [AGENTS.md](AGENTS.md) |
| 스펙·디자인 | `C:\_Hope\Ohsite\_핸드오프\` |
| 계획·작업로그 | `C:\_Dev\_md_doc\conlab\projects\ocy\` |