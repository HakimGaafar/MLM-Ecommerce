import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationsDir = join(import.meta.dirname, "..", "prisma", "migrations");

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_edit_requests'
    ORDER BY column_name`;
  console.log("product_edit_requests columns:", cols.map((c) => c.column_name).join(", "));

  const rows = await prisma.$queryRaw<{ migration_name: string; checksum: string }[]>`
    SELECT migration_name, checksum FROM _prisma_migrations ORDER BY migration_name`;

  const mismatches: string[] = [];
  for (const row of rows) {
    const path = join(migrationsDir, row.migration_name, "migration.sql");
    try {
      const content = readFileSync(path, "utf8");
      const fileChecksum = checksum(content);
      if (fileChecksum !== row.checksum) {
        mismatches.push(row.migration_name);
      }
    } catch {
      mismatches.push(`${row.migration_name} (file missing)`);
    }
  }

  console.log("\nChecksum mismatches (applied migration edited after deploy):");
  console.log(mismatches.length ? mismatches.join("\n") : "none");

  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const applied = new Set(rows.map((r) => r.migration_name));
  const pending = folders.filter((f) => !applied.has(f));
  console.log("\nPending migrations:", pending.length ? pending.join("\n") : "none");

  if (mismatches.length > 0 || pending.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
