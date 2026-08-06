import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 설정.
 *
 * **이 프로젝트에서 쓰는 명령은 `generate` 하나뿐이다.**
 * `push`·`migrate`는 DB에 직접 접속하므로 금지되어 있고(CLAUDE.md RULE-2),
 * 생성된 SQL은 사람이 직접 실행한다. 아래 dbCredentials는 타입 요구사항일 뿐
 * generate 경로에서는 사용되지 않는다.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
