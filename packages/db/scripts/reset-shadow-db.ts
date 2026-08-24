import { PrismaClient } from "@prisma/client";

const admin = new PrismaClient();
const shadowDb = "mlm_shadow_diff";

async function main() {
  await admin.$executeRawUnsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${shadowDb}' AND pid <> pg_backend_pid()`);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${shadowDb}"`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${shadowDb}"`);
  console.log(`Reset ${shadowDb}`);
}

main()
  .catch(console.error)
  .finally(() => admin.$disconnect());
