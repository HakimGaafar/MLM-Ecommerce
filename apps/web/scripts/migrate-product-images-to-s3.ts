/**
 * One-time migration: upload local /uploads/products/* files to S3 and update ProductImage.url.
 *
 * Prerequisites:
 *   STORAGE_PROVIDER=s3
 *   S3_BUCKET, S3_REGION, CDN_BASE_URL, AWS credentials (or IAM role)
 *
 * Usage:
 *   npm run media:migrate
 *   npm run media:migrate -- --dry-run
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@mlm/db";
import { getStorageConfig } from "../src/lib/storage/config";
import { createS3ProductImageStorage } from "../src/lib/storage/s3";
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = getStorageConfig();

  if (config.provider !== "s3") {
    console.error("Set STORAGE_PROVIDER=s3 and configure S3_BUCKET, S3_REGION, CDN_BASE_URL.");
    process.exit(1);
  }

  const storage = createS3ProductImageStorage(config);
  const rows = await prisma.productImage.findMany({
    where: { url: { startsWith: "/uploads/products/" } },
    include: { product: { select: { vendorId: true } } },
  });

  if (rows.length === 0) {
    console.log("No local product images to migrate.");
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Migrating ${rows.length} image(s)...`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const relative = row.url.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", relative);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = MIME_BY_EXT[ext];
    const extension =
      ext === "png" || ext === "webp" || ext === "gif"
        ? ext
        : ext === "jpeg" || ext === "jpg"
          ? "jpg"
          : null;

    if (!contentType || !extension) {
      console.warn(`Skip ${row.id}: unknown extension .${ext}`);
      skipped++;
      continue;
    }

    try {
      const buffer = await readFile(filePath);
      const vendorId = row.product.vendorId;

      if (dryRun) {
        console.log(`Would migrate ${row.url} (${buffer.length} bytes) -> S3 for vendor ${vendorId}`);
        ok++;
        continue;
      }

      const { url } = await storage.uploadProductImage({
        vendorId,
        buffer,
        contentType,
        extension: extension as "jpg" | "png" | "webp" | "gif",
      });

      await prisma.productImage.update({
        where: { id: row.id },
        data: { url },
      });

      console.log(`OK ${row.url} -> ${url}`);
      ok++;
    } catch (error) {
      console.error(`FAIL ${row.url}:`, error);
      failed++;
    }
  }

  console.log(`Done. ok=${ok} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
