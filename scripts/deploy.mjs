/**
 * 원클릭 배포 — 빌드·패키징 → 업로드 → 서버 배포 → 확인까지 한 번에.
 *
 *   npm run deploy
 *
 * 하는 일 (하나라도 실패하면 그 자리에서 멈춘다 — 반쯤 배포된 상태를 만들지 않는다):
 *   1. npm run pack:release   (빌드 → 반출금지 검사 → tar)
 *   2. scp 로 서버 업로드
 *   3. ssh 로 서버의 ~/deploy.sh 실행 (압축해제 → env 복사 → 슬롯 전환 → PM2 → 자체 확인)
 *   4. 밖에서 https 응답 확인 (Nginx·인증서·리다이렉트까지 지나는 진짜 사용자 경로)
 *
 * 접속은 SSH 키 인증 전제다(비밀번호를 어디에도 저장하지 않는다).
 * ⚠️ 카페24 웹방화벽에서 22번을 특정 IP만 허용하도록 제한해 두었다.
 *    개발 PC의 공인 IP가 바뀌면 2단계가 `Connection timed out`으로 막힌다 —
 *    그때는 카페24 콘솔에서 허용 IP를 갱신한다.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PROJECT_DIR = path.resolve(import.meta.dirname, "..");
const TARBALL_PATH = path.join(
  path.dirname(PROJECT_DIR),
  "oh4989-release",
  "oh4989-release.tar.gz",
);
const REMOTE_HOST = "oh4989@1.234.79.54";

/**
 * 정적 파일이 아니라 tRPC 왕복으로 확인한다 — "Next는 떴는데 서버 코드가 죽은"
 * 상태를 정적 파일 응답만으로는 구분할 수 없다.
 */
const PUBLIC_CHECK_URL = "https://oh4989.com/api/trpc/health.ping";

function runStep(stepLabel, command, args, options = {}) {
  console.log(`\n━━ ${stepLabel} ━━`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    // Windows에서 npm 같은 .cmd 실행에 필요하다
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${stepLabel} 실패 — 여기서 중단합니다 (서버는 이전 버전 그대로)`);
    process.exit(1);
  }
}

const startedAt = Date.now();

runStep("1/4 빌드·패키징", "npm", ["run", "pack:release"], { cwd: PROJECT_DIR });

if (!existsSync(TARBALL_PATH)) {
  console.error(`✗ 산출물이 없습니다: ${TARBALL_PATH}`);
  process.exit(1);
}

runStep("2/4 서버 업로드", "scp", [
  "-o", "BatchMode=yes",
  TARBALL_PATH,
  `${REMOTE_HOST}:/home/oh4989/`,
]);

// bash -lc: 로그인 셸로 실행해 PATH(pm2·node)가 대화형 접속과 같게 잡히도록 한다
runStep("3/4 서버 배포", "ssh", [
  "-o", "BatchMode=yes",
  REMOTE_HOST,
  "bash -lc '~/deploy.sh'",
]);

// 서버 안 확인(deploy.sh의 127.0.0.1 체크)과 별개로, 밖에서 한 번 더 —
// Nginx·인증서·리다이렉트까지 지나는 실제 사용자 경로가 살아 있는지 본다
console.log("\n━━ 4/4 외부 응답 확인 ━━");
try {
  const response = await fetch(PUBLIC_CHECK_URL, { redirect: "follow" });
  if (!response.ok) {
    console.error(`✗ ${PUBLIC_CHECK_URL} → HTTP ${response.status}`);
    console.error("  서버 배포는 끝났지만 밖에서 안 열립니다 — Nginx 로그를 확인하세요.");
    process.exit(1);
  }
  console.log(`✓ ${PUBLIC_CHECK_URL} → HTTP ${response.status}`);
} catch (fetchError) {
  console.error(`✗ 외부 확인 실패: ${fetchError.message}`);
  process.exit(1);
}

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`\n배포 완료 (${elapsedSeconds}초). 문제가 보이면 서버에서:  ./deploy.sh rollback`);
