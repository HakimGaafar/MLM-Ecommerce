import type { Order, OrderItem, OrderUnitStatus, ProductFulfillmentType } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import { returnWindowDays as defaultReturnWindowDays } from "../business-rules";
import { getReturnWindowDays } from "../platform-config/platform-config.service";

export type OrderUnitCreateInput = {
  productId: string | null;
  vendorId: string;
  fulfillmentType: ProductFulfillmentType;
  productNameSnapshot: string;
  vendorNameSnapshot: string;
  quantity: 1;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  unitIndex: number;
  unitLabel: string;
  unitStatus: OrderUnitStatus;
};

export type ReturnableUnitDto = {
  id: string;
  unitIndex: number | null;
  unitLabel: string | null;
  productId: string | null;
  productName: string;
  vendorName: string;
  unitPrice: string;
  lineTotal: string;
  unitStatus: OrderUnitStatus;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Expand cart/checkout lines (qty N) into N unit rows with labels ORDERNO-1 … ORDERNO-N. */
export function buildUnitRowsForOrder(
  orderNo: string,
  lines: Array<{
    productId: string | null;
    vendorId: string;
    fulfillmentType: ProductFulfillmentType;
    name: string;
    vendorName: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>,
): OrderUnitCreateInput[] {
  const rows: OrderUnitCreateInput[] = [];
  let unitIndex = 0;

  for (const line of lines) {
    const qty = Math.max(1, line.quantity);
    const unitPrice = line.unitPrice;
    for (let i = 0; i < qty; i += 1) {
      unitIndex += 1;
      rows.push({
        productId: line.productId,
        vendorId: line.vendorId,
        fulfillmentType: line.fulfillmentType,
        productNameSnapshot: line.name,
        vendorNameSnapshot: line.vendorName,
        quantity: 1,
        unitPrice,
        lineTotal: unitPrice,
        unitIndex,
        unitLabel: `${orderNo}-${unitIndex}`,
        unitStatus: "ACTIVE",
      });
    }
  }

  return rows;
}

export function isUnitReturnable(item: Pick<OrderItem, "unitStatus" | "orderReturnId">): boolean {
  return item.unitStatus === "ACTIVE" && !item.orderReturnId;
}

export async function listReturnableUnitsForOrder(orderId: string): Promise<ReturnableUnitDto[]> {
  const rows = await prisma.orderItem.findMany({
    where: { orderId, unitStatus: "ACTIVE", orderReturnId: null },
    orderBy: [{ unitIndex: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    unitIndex: row.unitIndex,
    unitLabel: row.unitLabel,
    productId: row.productId,
    productName: row.productNameSnapshot,
    vendorName: row.vendorNameSnapshot,
    unitPrice: row.unitPrice.toString(),
    lineTotal: row.lineTotal.toString(),
    unitStatus: row.unitStatus,
  }));
}

export async function getReturnUnitIdsForReturn(orderReturnId: string): Promise<string[]> {
  const rows = await prisma.orderItem.findMany({
    where: { orderReturnId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function linkUnitsToReturn(params: {
  orderReturnId: string;
  orderId: string;
  unitIds: string[];
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.tx ?? prisma;
  const uniqueIds = [...new Set(params.unitIds)];
  if (uniqueIds.length === 0) {
    throw new Error("RETURN_UNITS_REQUIRED");
  }

  const units = await db.orderItem.findMany({
    where: { id: { in: uniqueIds }, orderId: params.orderId },
    select: { id: true, unitStatus: true, orderReturnId: true },
  });

  if (units.length !== uniqueIds.length) {
    throw new Error("RETURN_UNITS_INVALID");
  }

  for (const unit of units) {
    if (!isUnitReturnable(unit)) {
      throw new Error("RETURN_UNITS_NOT_RETURNABLE");
    }
  }

  await db.orderItem.updateMany({
    where: { id: { in: uniqueIds } },
    data: {
      orderReturnId: params.orderReturnId,
      unitStatus: "RETURN_REQUESTED",
    },
  });
}

export async function releaseUnitsFromReturn(
  orderReturnId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  await db.orderItem.updateMany({
    where: { orderReturnId },
    data: {
      orderReturnId: null,
      unitStatus: "ACTIVE",
    },
  });
}

export async function markReturnUnitsCompleted(
  orderReturnId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  await db.orderItem.updateMany({
    where: { orderReturnId },
    data: { unitStatus: "RETURNED" },
  });
}

/** Sum line totals for units linked to a return (refund basis for partial returns). */
export async function sumReturnedUnitsLineTotal(orderReturnId: string): Promise<number> {
  const rows = await prisma.orderItem.findMany({
    where: { orderReturnId },
    select: { lineTotal: true },
  });
  return roundMoney(rows.reduce((sum, row) => sum + Number(row.lineTotal), 0));
}

/**
 * Recompute order subtotal from non-returned units; adjust total using original ratios.
 * Keeps shipping/VAT proportional to remaining merchandise value.
 */
export async function recalculateOrderTotalsAfterReturn(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      subtotal: true,
      shippingFee: true,
      discountTotal: true,
      vatTotal: true,
      totalAmount: true,
      items: { select: { lineTotal: true, unitStatus: true } },
    },
  });
  if (!order) return;

  const originalSubtotal = Number(order.subtotal);
  if (originalSubtotal <= 0) return;

  const activeSubtotal = roundMoney(
    order.items
      .filter((i) => i.unitStatus !== "RETURNED")
      .reduce((sum, i) => sum + Number(i.lineTotal), 0),
  );

  const ratio = Math.min(1, Math.max(0, activeSubtotal / originalSubtotal));

  const shippingFee = roundMoney(Number(order.shippingFee) * ratio);
  const discountTotal = roundMoney(Number(order.discountTotal) * ratio);
  const vatTotal = roundMoney(Number(order.vatTotal) * ratio);
  const totalAmount = roundMoney(activeSubtotal + shippingFee - discountTotal + vatTotal);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: new Prisma.Decimal(activeSubtotal),
      shippingFee: new Prisma.Decimal(shippingFee),
      discountTotal: new Prisma.Decimal(discountTotal),
      vatTotal: new Prisma.Decimal(vatTotal),
      totalAmount: new Prisma.Decimal(totalAmount),
    },
  });
}

const OPEN_RETURN_INVOICE_BLOCK_STATUSES = [
  "REQUESTED",
  "RECEIPT_IN_PROGRESS",
  "RECEIPT_COMPLETED",
  "PROCESSING_IN_PROGRESS",
  "PROCESSING_COMPLETED",
  "REFUND_IN_PROGRESS",
] as const;

/** Prerequisite for any invoice: completed, paid, delivered, no open return. */
export function computeOrderInvoiceEligible(
  order: Pick<Order, "status" | "paymentStatus" | "deliveredAt" | "updatedAt">,
  hasOpenReturn: boolean,
): boolean {
  if (hasOpenReturn) return false;
  if (order.status !== "COMPLETED") return false;
  if (order.paymentStatus !== "PAID") return false;

  const deliveryMoment =
    order.deliveredAt ?? order.updatedAt;
  return Boolean(deliveryMoment);
}

export async function isOrderInvoiceEligible(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paymentStatus: true,
      deliveredAt: true,
      updatedAt: true,
    },
  });
  if (!order) return false;

  const openReturn = await prisma.orderReturn.findFirst({
    where: {
      orderId,
      status: { in: [...OPEN_RETURN_INVOICE_BLOCK_STATUSES] },
    },
    select: { id: true },
  });

  return computeOrderInvoiceEligible(order, Boolean(openReturn));
}

export function computeFinalInvoiceAllowed(
  order: Pick<Order, "status" | "paymentStatus" | "deliveredAt" | "updatedAt">,
  hasOpenReturn: boolean,
  returnWindowDays: number = defaultReturnWindowDays,
): boolean {
  if (!computeOrderInvoiceEligible(order, hasOpenReturn)) return false;

  const deliveryMoment = order.deliveredAt ?? order.updatedAt;
  const deadline = new Date(deliveryMoment);
  deadline.setUTCDate(deadline.getUTCDate() + returnWindowDays);
  return Date.now() > deadline.getTime();
}

export async function refreshFinalInvoiceAllowed(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paymentStatus: true,
      deliveredAt: true,
      updatedAt: true,
      finalInvoiceAllowed: true,
      marketId: true,
    },
  });
  if (!order) return false;

  const openReturn = await prisma.orderReturn.findFirst({
    where: {
      orderId,
      status: { in: [...OPEN_RETURN_INVOICE_BLOCK_STATUSES] },
    },
    select: { id: true },
  });

  const allowed = computeFinalInvoiceAllowed(
    order,
    Boolean(openReturn),
    await getReturnWindowDays(order.marketId),
  );
  if (allowed !== order.finalInvoiceAllowed) {
    await prisma.order.update({
      where: { id: orderId },
      data: { finalInvoiceAllowed: allowed },
    });
  }
  return allowed;
}

/**
 * Split legacy aggregate lines (quantity > 1) into unit rows. Idempotent when units already expanded.
 */
export async function expandOrderItemsToUnits(orderId: string, orderNo: string): Promise<number> {
  const legacy = await prisma.orderItem.findMany({
    where: { orderId, quantity: { gt: 1 } },
    orderBy: { createdAt: "asc" },
    include: { rating: true },
  });
  if (legacy.length === 0) return 0;

  let maxIndex =
    (
      await prisma.orderItem.aggregate({
        where: { orderId, unitIndex: { not: null } },
        _max: { unitIndex: true },
      })
    )._max.unitIndex ?? 0;

  let created = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of legacy) {
      const unitPrice = row.unitPrice;
      const newRows: Prisma.OrderItemCreateManyInput[] = [];
      for (let i = 0; i < row.quantity; i += 1) {
        maxIndex += 1;
        newRows.push({
          orderId,
          productId: row.productId,
          vendorId: row.vendorId,
          productNameSnapshot: row.productNameSnapshot,
          vendorNameSnapshot: row.vendorNameSnapshot,
          quantity: 1,
          unitPrice,
          lineTotal: unitPrice,
          unitIndex: maxIndex,
          unitLabel: `${orderNo}-${maxIndex}`,
          unitStatus: row.unitStatus,
          vendorFulfillmentStatus: row.vendorFulfillmentStatus,
          vendorFulfillmentUpdatedAt: row.vendorFulfillmentUpdatedAt,
        });
      }

      await tx.orderItem.createMany({ data: newRows });
      created += newRows.length;

      if (row.rating) {
        const firstUnitIndex = maxIndex - row.quantity + 1;
        const firstNew = await tx.orderItem.findFirst({
          where: { orderId, unitIndex: firstUnitIndex },
          select: { id: true },
        });
        if (firstNew) {
          await tx.orderItemRating.update({
            where: { orderItemId: row.id },
            data: { orderItemId: firstNew.id },
          });
        }
      }

      await tx.orderItem.delete({ where: { id: row.id } });
    }
  });

  return created;
}

/** Backfill unitIndex/label on qty=1 rows missing labels. */
export async function backfillOrderUnitLabels(orderId: string, orderNo: string): Promise<void> {
  const missing = await prisma.orderItem.findMany({
    where: { orderId, unitLabel: null },
    orderBy: { createdAt: "asc" },
  });
  if (missing.length === 0) return;

  let index =
    (
      await prisma.orderItem.aggregate({
        where: { orderId, unitIndex: { not: null } },
        _max: { unitIndex: true },
      })
    )._max.unitIndex ?? 0;

  for (const row of missing) {
    index += 1;
    await prisma.orderItem.update({
      where: { id: row.id },
      data: {
        unitIndex: index,
        unitLabel: `${orderNo}-${index}`,
        quantity: 1,
        lineTotal: row.unitPrice,
      },
    });
  }
}
