import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationsDir = join(import.meta.dirname, "..", "prisma", "migrations");

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertMigrationFolderOrder(folders: string[]): string[] {
  const issues: string[] = [];
  const sorted = [...folders].sort();
  for (let i = 0; i < folders.length; i++) {
    if (folders[i] !== sorted[i]) {
      issues.push(`Out of order at index ${i}: found ${folders[i]}, expected ${sorted[i]}`);
    }
  }
  const stamps = folders.map((f) => f.slice(0, 14));
  const seen = new Set<string>();
  for (const stamp of stamps) {
    if (seen.has(stamp)) issues.push(`Duplicate migration timestamp prefix: ${stamp}`);
    seen.add(stamp);
  }
  for (let i = 1; i < folders.length; i++) {
    if (folders[i]! <= folders[i - 1]!) {
      issues.push(`Timestamp not ascending: ${folders[i - 1]} -> ${folders[i]}`);
    }
  }
  return issues;
}

async function main() {
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const orderIssues = assertMigrationFolderOrder(folders);
  console.log("Migration order check:");
  if (orderIssues.length === 0) {
    console.log(`OK — ${folders.length} migrations, last: ${folders[folders.length - 1]}`);
  } else {
    console.log(orderIssues.join("\n"));
  }

  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_edit_requests'
    ORDER BY column_name`;
  console.log("\nproduct_edit_requests columns:", cols.map((c) => c.column_name).join(", "));

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

  const applied = new Set(rows.map((r) => r.migration_name));
  const pending = folders.filter((f) => !applied.has(f));
  console.log("\nPending migrations:", pending.length ? pending.join("\n") : "none");

  if (orderIssues.length > 0 || mismatches.length > 0 || pending.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
