import path from "node:path";

import { defineConfig } from "vitest/config";

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
