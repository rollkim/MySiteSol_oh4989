import { createInterface } from "node:readline";

import bcrypt from "bcryptjs";

/**
 * 관리자 비밀번호 → bcrypt 해시. admin_users INSERT SQL에 붙여넣는 용도.
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
