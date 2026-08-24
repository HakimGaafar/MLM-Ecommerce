import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shadowDb = "mlm_shadow_diff";

async function main() {
  const existing = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${shadowDb}) AS exists`;
  if (!existing[0]?.exists) {
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${shadowDb}"`);
    console.log(`Created database ${shadowDb}`);
  } else {
    console.log(`Database ${shadowDb} already exists`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
