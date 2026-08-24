import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationsDir = join(import.meta.dirname, "..", "prisma", "migrations");

function fileChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows = await prisma.$queryRaw<{ migration_name: string; checksum: string }[]>`
    SELECT migration_name, checksum FROM _prisma_migrations ORDER BY migration_name`;

  let repaired = 0;
  for (const row of rows) {
    const path = join(migrationsDir, row.migration_name, "migration.sql");
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      console.warn(`skip (missing file): ${row.migration_name}`);
      continue;
    }
    const next = fileChecksum(content);
    if (next === row.checksum) continue;

    console.log(`${dryRun ? "[dry-run] " : ""}repair ${row.migration_name}`);
    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE _prisma_migrations SET checksum = ${next} WHERE migration_name = ${row.migration_name}`;
    }
    repaired += 1;
  }

  const folders = new Set(
    readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
  const unknown = rows.filter((r) => !folders.has(r.migration_name));
  if (unknown.length) {
    console.warn("\nApplied migrations with no folder on disk:");
    for (const row of unknown) console.warn(`  ${row.migration_name}`);
  }

  console.log(`\n${dryRun ? "Would repair" : "Repaired"} ${repaired} checksum(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
