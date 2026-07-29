/**
 * 사원번호(로그인 코드) 부트스트랩 — 코드가 없는 모든 사용자에게 자동 발급.
 * 실행: DATABASE_URL 설정 후  `node --import tsx prisma/backfill-codes.ts`
 * 출력된 표에서 각자 코드를 확인해 개별 전달(관리자 코드로 먼저 로그인해 이후 설정에서 관리).
 */
import 'dotenv/config'; // apps/api/.env의 DATABASE_URL 자동 로드 (윈도우에서도 동일하게 동작)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 혼동 문자(I, L, O, 0, 1) 제외 — 웹 lib/employeeCode.ts와 동일 규칙
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;
const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
function gen(): string {
  let code = pick(LETTERS) + pick(DIGITS);
  for (let i = 0; i < 6; i++) code += pick(ALL);
  return code;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { employeeCode: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  if (users.length === 0) {
    console.log('✅ 모든 사용자에게 이미 사원번호가 있습니다.');
    return;
  }
  console.log(`🔑 사원번호 발급 대상: ${users.length}명\n`);
  const rows: { name: string; email: string; code: string; admin: boolean }[] = [];
  for (const u of users) {
    // 유니크 충돌 시 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = gen();
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { employeeCode: code },
        });
        rows.push({ name: u.name, email: u.email, code, admin: u.isAdmin });
        break;
      } catch {
        if (attempt === 4) throw new Error(`코드 발급 실패: ${u.name}`);
      }
    }
  }
  console.log('┌──────────────────────────────────────────────');
  for (const r of rows) {
    console.log(`│ ${r.admin ? '👑' : '  '} ${r.name.padEnd(8)} ${r.code}   (${r.email})`);
  }
  console.log('└──────────────────────────────────────────────');
  console.log('\n⚠️ 코드는 로그인 키입니다 — 각자에게 개별(비공개) 전달하세요.');
  console.log('   이후 변경/재발급은 설정 → Members의 Code 칸에서 가능합니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
