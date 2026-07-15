/**
 * Re-runs refund ledger logic for REFUND_COMPLETED returns (idempotent).
 * Use after fixing reversal logic so old pay-ins are marked REVERSED.
 *
 * Usage:
 *   npm run return-ledger:repair
 *   npm run return-ledger:repair -- --dry-run
 */
import { prisma } from "@mlm/db";
import { processReturnRefund } from "@mlm/domain";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const returns = await prisma.orderReturn.findMany({
    where: { status: "REFUND_COMPLETED" },
    select: { id: true, orderId: true },
    orderBy: { createdAt: "asc" },
  });

  const staleCredits = await prisma.walletTransaction.count({
    where: {
      entryType: { in: ["VENDOR_EARNING", "AFFILIATE_COMMISSION"] },
      direction: "CREDIT",
      status: { in: ["PENDING", "APPROVED"] },
      referenceType: "order",
      referenceId: {
        in: returns.map((r) => r.orderId),
      },
    },
  });

  console.log(`REFUND_COMPLETED returns: ${returns.length}`);
  console.log(`Stale credits on those orders (PENDING/APPROVED): ${staleCredits}`);

  if (dryRun) {
    console.log("Dry run — no changes written.");
    return;
  }

  let repaired = 0;
  for (const row of returns) {
    await processReturnRefund(row.id);
    repaired += 1;
    console.log(`  repaired return ${row.id} (order ${row.orderId})`);
  }

  const staleAfter = await prisma.walletTransaction.count({
    where: {
      entryType: { in: ["VENDOR_EARNING", "AFFILIATE_COMMISSION"] },
      direction: "CREDIT",
      status: { in: ["PENDING", "APPROVED"] },
      referenceType: "order",
      referenceId: {
        in: returns.map((r) => r.orderId),
      },
    },
  });

  console.log(`Repaired ${repaired} return(s). Stale credits after: ${staleAfter}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
