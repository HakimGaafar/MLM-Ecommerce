/**
 * Expands legacy order lines (quantity > 1) into per-unit rows and backfills unit labels.
 * Safe to run multiple times.
 *
 * Usage: npm run order-units:backfill
 */
import { prisma } from "@mlm/db";
import {
  backfillOrderUnitLabels,
  expandOrderItemsToUnits,
} from "../packages/domain/src/orders/order-units.service";

async function main() {
  const orders = await prisma.order.findMany({
    select: { id: true, orderNo: true },
    orderBy: { createdAt: "asc" },
  });

  let expanded = 0;
  let labeled = 0;

  for (const order of orders) {
    const created = await expandOrderItemsToUnits(order.id, order.orderNo);
    expanded += created;
    await backfillOrderUnitLabels(order.id, order.orderNo);
    const missing = await prisma.orderItem.count({
      where: { orderId: order.id, unitLabel: null },
    });
    if (missing === 0) labeled += 1;
  }

  console.log(
    `Order units backfill: ${orders.length} order(s) scanned, ${expanded} unit row(s) created, ${labeled} fully labeled.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
