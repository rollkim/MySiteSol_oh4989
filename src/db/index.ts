import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * 전역 커넥션 풀.
 *
 * `new Pool()`은 접속하지 않는다 — 첫 쿼리에서 연결한다. 그래서 DATABASE_URL 없이도
 * 앱이 뜨고, 쿼리를 실제로 부르는 시점에만 실패한다.
 *
 * RAM 2GB 서버라 커넥션을 넉넉히 열 여유가 없다. PostgreSQL 커넥션 하나는
 * 수 MB~수십 MB를 쓰고, Next standalone은 단일 프로세스(PM2 fork)로 돈다.
 * 저트래픽 단일 상점 사이트에 10개는 충분하고, 넘치면 대기시키는 편이
 * 커넥션을 더 여는 것보다 안전하다.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;
