/**
 * One-time backfill: post VENDOR_EARNING for all COMPLETED + PAID orders.
 *
 * Prerequisites:
 *   DATABASE_URL in .env (repo root)
 *
 * Usage:
 *   npm run vendor-earnings:backfill
 *   npm run vendor-earnings:backfill -- --dry-run
 */
import { prisma } from "@mlm/db";
import { backfillVendorEarningsForCompletedPaidOrders } from "@mlm/domain";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const eligible = await prisma.order.count({
    where: { status: "COMPLETED", paymentStatus: "PAID" },
  });
  const existing = await prisma.walletTransaction.count({
    where: { entryType: "VENDOR_EARNING", direction: "CREDIT" },
  });

  console.log(`Orders eligible (COMPLETED + PAID): ${eligible}`);
  console.log(`Existing VENDOR_EARNING credits: ${existing}`);

  if (dryRun) {
    console.log("Dry run — no changes written.");
    return;
  }

  const result = await backfillVendorEarningsForCompletedPaidOrders();
  const after = await prisma.walletTransaction.count({
    where: { entryType: "VENDOR_EARNING", direction: "CREDIT" },
  });

  console.log("Backfill complete:");
  console.log(JSON.stringify(result, null, 2));
  console.log(`VENDOR_EARNING credits after: ${after} (+${after - existing} new)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
