/**
 * Если в БД нет ни одного пользователя (типично после первого deploy),
 * поднимаем демо-данные через prisma/seed.ts — иначе вход по README не работает.
 */
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`[seed-if-empty] Пользователей: ${count}, сид пропускаем`);
    return;
  }
  console.log("[seed-if-empty] Пользователей нет — запуск prisma/seed.ts");
  const r = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
