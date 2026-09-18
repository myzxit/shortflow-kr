/**
 * 무제한 관리자 계정을 만들거나, 기존 계정을 관리자로 올린다.
 *
 *   npm run admin -- admin@example.com '비밀번호8자이상'
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... npm run admin
 *
 * 관리자는 크레딧이 차감되지 않는다(src/lib/credits.ts 의 isUnlimited).
 * 이미 있는 이메일이면 비밀번호를 새로 설정하고 role 만 admin 으로 바꾼다.
 */

import { loadEnv } from "../worker/env";

loadEnv();

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { ADMIN_ROLE } from "../src/lib/credits";

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";
  const name = process.argv[4] || process.env.ADMIN_NAME || "관리자";

  if (!email || !password) {
    console.error(
      "사용법: npm run admin -- <이메일> <비밀번호>\n" +
        "또는 ADMIN_EMAIL / ADMIN_PASSWORD 환경변수를 설정하세요."
    );
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("이메일 형식이 올바르지 않습니다.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("비밀번호는 8자 이상이어야 합니다.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: ADMIN_ROLE },
    create: { email, name, passwordHash, role: ADMIN_ROLE, creditSeconds: 0 },
  });

  console.log(
    existing
      ? `기존 계정을 관리자로 변경했습니다: ${user.email}`
      : `관리자 계정을 만들었습니다: ${user.email}`
  );
  console.log("크레딧: 무제한 (차감되지 않음)");
}

main()
  .catch((err) => {
    console.error("실패:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
