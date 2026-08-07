<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# oh4989 추가 주의사항

- **빌드는 로컬에서만.** 서버(RAM 2GB)에서 `next build`를 실행하지 않는다. 배포는 `standalone` 산출물 tar 반출 방식이다.
- **지도는 절대 서버 렌더하지 않는다.** 네이버 지도 SDK(NCP Maps — SPEC 수정 이력 #5로 카카오맵에서 전환)는 `next/dynamic({ ssr: false })` 고정.
- **이미지 리사이즈는 브라우저 Canvas에서 한다.** `sharp`를 도입하지 않는다 - 서버 메모리 경합과 플랫폼별 네이티브 바이너리 문제를 피하기 위한 결정. `next/image`도 같은 이유로 도입 전 검토가 필요하다.
- 상세 규칙은 CLAUDE.md 참조.
