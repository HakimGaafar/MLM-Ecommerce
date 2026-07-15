import { Prisma, prisma } from "@mlm/db";
import { week1BusinessRules } from "../business-rules";
import { getPlatformConfig } from "../platform-config/platform-config.service";
import { ensureWalletInTx } from "./wallet.service";
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Vendor's product lines on the order (sum of line totals). */
export function sumVendorLineTotals(
  items: { vendorId: string; lineTotal: Prisma.Decimal | { toString(): string } }[],
  vendorId: string,
): number {
  let sum = 0;
  for (const item of items) {
    if (item.vendorId !== vendorId) continue;
    sum += Number(item.lineTotal);
  }
  return roundMoney(sum);
}

/**
 * Vendor share basis: vendor line subtotal, with order-level discount applied proportionally
 * (same eligible basis philosophy as affiliate pool on order subtotal − discounts).
 */
export function getVendorEligibleAmount(params: {
  vendorLineTotal: number;
  orderSubtotal: number;
  orderDiscountTotal: number;
}): number {
  const { vendorLineTotal, orderSubtotal, orderDiscountTotal } = params;
  if (vendorLineTotal <= 0) return 0;
  if (orderSubtotal <= 0) return vendorLineTotal;

  const orderEligible = Math.max(orderSubtotal - orderDiscountTotal, 0);
  const ratio = orderEligible / orderSubtotal;
  return roundMoney(vendorLineTotal * ratio);
}

export function calculateVendorEarningAmount(vendorEligibleAmount: number, vendorRate: number): number {
  return roundMoney(Math.max(vendorEligibleAmount * vendorRate, 0));
}

async function postVendorEarningEntry(params: {
  tx: Prisma.TransactionClient;
  walletId: string;
  ownerUserId: string;
  amount: number;
  orderId: string;
  orderNo: string;
  vendorId: string;
  vendorName: string;
  vendorLineTotal: number;
  vendorEligibleAmount: number;
  vendorRate: number;
  orderItemId: string;
  unitLabel?: string | null;
}): Promise<boolean> {
  const idempotencyKey = `vendor:order:${params.orderId}:unit:${params.orderItemId}`;
  const existing = await params.tx.walletTransaction.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return false;

  const amountDec = new Prisma.Decimal(params.amount);
  await params.tx.walletTransaction.create({
    data: {
      walletId: params.walletId,
      userId: params.ownerUserId,
      entryType: "VENDOR_EARNING",
      direction: "CREDIT",
      amount: amountDec,
      status: "PENDING",
      referenceType: "order",
      referenceId: params.orderId,
      idempotencyKey,
      metaJson: {
        orderId: params.orderId,
        orderNo: params.orderNo,
        vendorId: params.vendorId,
        vendorName: params.vendorName,
        vendorLineTotal: params.vendorLineTotal,
        vendorEligibleAmount: params.vendorEligibleAmount,
        vendorRate: params.vendorRate,
        orderItemId: params.orderItemId,
        ...(params.unitLabel ? { unitLabel: params.unitLabel } : {}),
        kind: "vendor_earning_accrual",
      },
    },
  });

  await params.tx.wallet.update({
    where: { id: params.walletId },
    data: { pendingBalance: { increment: amountDec } },
  });

  return true;
}

/**
 * Credits vendor owner wallet(s) when order is COMPLETED and PAID.
 * One PENDING row per vendor on the order. Idempotent per order + vendor.
 */
export async function accrueVendorEarningsForCompletedOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      subtotal: true,
      discountTotal: true,
      paymentStatus: true,
      status: true,
      marketId: true,
      items: {
        select: {
          id: true,
          vendorId: true,
          lineTotal: true,
          unitLabel: true,
          unitStatus: true,
          vendor: { select: { id: true, ownerUserId: true, storeName: true } },
        },
      },
    },
  });
  if (!order || order.status !== "COMPLETED" || order.paymentStatus !== "PAID") {
    return;
  }

  const orderSubtotal = Number(order.subtotal);
  const orderDiscountTotal = Number(order.discountTotal);
  const platformConfig = await getPlatformConfig(order.marketId);
  const { vendorRate } = platformConfig;

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.unitStatus === "RETURNED") continue;

      const vendorLineTotal = Number(item.lineTotal);
      const vendorEligibleAmount = getVendorEligibleAmount({
        vendorLineTotal,
        orderSubtotal,
        orderDiscountTotal,
      });
      const amount = calculateVendorEarningAmount(vendorEligibleAmount, vendorRate);
      if (amount <= 0) continue;

      const ownerUserId = item.vendor.ownerUserId;
      const vendorName = item.vendor.storeName ?? "Vendor";

      let wallet = await tx.wallet.findUnique({
        where: { userId_marketId: { userId: ownerUserId, marketId: order.marketId } },
      });
      if (!wallet) {
        wallet = await ensureWalletInTx(tx, ownerUserId, order.marketId);
      }

      await postVendorEarningEntry({
        tx,
        walletId: wallet.id,
        ownerUserId,
        amount,
        orderId: order.id,
        orderNo: order.orderNo,
        vendorId: item.vendorId,
        vendorName,
        vendorLineTotal,
        vendorEligibleAmount,
        vendorRate,
        orderItemId: item.id,
        unitLabel: item.unitLabel,
      });
    }
  });
}

async function markVendorAccrualReversed(
  tx: Prisma.TransactionClient,
  prior: { id: string; metaJson: unknown },
  orderReturnId: string,
): Promise<void> {
  const priorMeta =
    prior.metaJson && typeof prior.metaJson === "object" && !Array.isArray(prior.metaJson)
      ? (prior.metaJson as Record<string, unknown>)
      : {};
  await tx.walletTransaction.update({
    where: { id: prior.id },
    data: {
      status: "REVERSED",
      metaJson: {
        ...priorMeta,
        reversedAt: new Date().toISOString(),
        orderReturnId,
        kind: priorMeta.kind ?? "vendor_earning_accrual",
      },
    },
  });
}

/**
 * When an accrual was released to available after a PENDING reversal was posted,
 * finalize the reversal debit against available so balances stay correct.
 */
async function reconcileVendorReversalBalance(
  tx: Prisma.TransactionClient,
  prior: { id: string; walletId: string; status: string; amount: Prisma.Decimal },
  reversal: { id: string; status: string; amount: Prisma.Decimal },
): Promise<void> {
  if (prior.status !== "APPROVED" || reversal.status !== "PENDING") return;

  await tx.walletTransaction.update({
    where: { id: reversal.id },
    data: { status: "APPROVED" },
  });
  await tx.wallet.update({
    where: { id: prior.walletId },
    data: { availableBalance: { decrement: reversal.amount } },
  });
}

/** Reverses vendor earning credits for units in a return (idempotent per return + unit). */
export async function reverseVendorEarningsForOrderInTx(params: {
  tx: Prisma.TransactionClient;
  orderId: string;
  orderReturnId: string;
  orderNo: string;
  unitIds?: string[];
}): Promise<void> {
  const unitFilter =
    params.unitIds && params.unitIds.length > 0
      ? {
          OR: [
            ...params.unitIds.map((orderItemId) => ({
              idempotencyKey: `vendor:order:${params.orderId}:unit:${orderItemId}`,
            })),
            // Legacy whole-vendor accruals (pre–Phase II): reversed proportionally below
            { idempotencyKey: { startsWith: `vendor:order:${params.orderId}:vendor:` } },
          ],
        }
      : {
          OR: [
            { idempotencyKey: { startsWith: `vendor:order:${params.orderId}:unit:` } },
            { idempotencyKey: { startsWith: `vendor:order:${params.orderId}:vendor:` } },
          ],
        };

  const accruals = await params.tx.walletTransaction.findMany({
    where: {
      entryType: "VENDOR_EARNING",
      direction: "CREDIT",
      referenceType: "order",
      referenceId: params.orderId,
      ...unitFilter,
    },
  });

  const returnedUnits =
    params.unitIds ??
    (
      await params.tx.orderItem.findMany({
        where: { orderReturnId: params.orderReturnId },
        select: { id: true, lineTotal: true },
      })
    ).map((u) => u.id);

  const returnedLineTotal = roundMoney(
    (
      await params.tx.orderItem.findMany({
        where: { id: { in: returnedUnits } },
        select: { lineTotal: true },
      })
    ).reduce((sum, row) => sum + Number(row.lineTotal), 0),
  );

  for (const prior of accruals) {
    if (prior.status !== "PENDING" && prior.status !== "APPROVED") continue;

    const meta = prior.metaJson as Record<string, unknown> | null;
    const vendorId = typeof meta?.vendorId === "string" ? meta.vendorId : "unknown";
    const orderItemId = typeof meta?.orderItemId === "string" ? meta.orderItemId : null;
    const isLegacyVendorKey = prior.idempotencyKey.includes(":vendor:") && !prior.idempotencyKey.includes(":unit:");

    if (orderItemId && returnedUnits.length > 0 && !returnedUnits.includes(orderItemId)) {
      continue;
    }

    let reversalAmount = prior.amount;
    if (isLegacyVendorKey && returnedLineTotal > 0) {
      const vendorLineTotal = typeof meta?.vendorLineTotal === "number" ? meta.vendorLineTotal : Number(meta?.vendorLineTotal ?? 0);
      if (vendorLineTotal > 0) {
        const ratio = Math.min(1, returnedLineTotal / vendorLineTotal);
        reversalAmount = new Prisma.Decimal(roundMoney(Number(prior.amount) * ratio));
      }
    }

    const reversalKey = orderItemId
      ? `vendor-reversal:return:${params.orderReturnId}:unit:${orderItemId}`
      : `vendor-reversal:return:${params.orderReturnId}:vendor:${vendorId}`;
    const existing = await params.tx.walletTransaction.findUnique({
      where: { idempotencyKey: reversalKey },
    });
    if (existing) {
      await markVendorAccrualReversed(params.tx, prior, params.orderReturnId);
      await reconcileVendorReversalBalance(params.tx, prior, existing);
      continue;
    }

    const amountDec = reversalAmount;
    const reversal = await params.tx.walletTransaction.create({
      data: {
        walletId: prior.walletId,
        userId: prior.userId,
        entryType: "VENDOR_EARNING",
        direction: "DEBIT",
        amount: amountDec,
        status: prior.status,
        referenceType: "order_return",
        referenceId: params.orderReturnId,
        idempotencyKey: reversalKey,
        metaJson: {
          orderId: params.orderId,
          orderNo: params.orderNo,
          orderReturnId: params.orderReturnId,
          vendorId,
          ...(orderItemId ? { orderItemId } : {}),
          reversedTransactionId: prior.id,
          kind: "vendor_earning_reversal",
          reason: "refund_completed",
        },
      },
    });

    const delta = amountDec.mul(-1);
    if (prior.status === "APPROVED") {
      await params.tx.wallet.update({
        where: { id: prior.walletId },
        data: { availableBalance: { increment: delta } },
      });
    } else if (prior.status === "PENDING") {
      await params.tx.wallet.update({
        where: { id: prior.walletId },
        data: { pendingBalance: { increment: delta } },
      });
    }

    const isFullReversal = Number(amountDec) >= Number(prior.amount) - 0.005;
    if (isFullReversal) {
      await markVendorAccrualReversed(params.tx, prior, params.orderReturnId);
    }
    await reconcileVendorReversalBalance(params.tx, prior, reversal);
  }
}

export type VendorEarningsBackfillResult = {
  ordersScanned: number;
  ordersProcessed: number;
  vendorsCredited: number;
  skippedAlreadyPosted: number;
};

/**
 * Posts vendor earnings for all COMPLETED + PAID orders (idempotent).
 * Safe to run multiple times — existing keys are skipped.
 */
export async function backfillVendorEarningsForCompletedPaidOrders(): Promise<VendorEarningsBackfillResult> {
  const orders = await prisma.order.findMany({
    where: { status: "COMPLETED", paymentStatus: "PAID" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let vendorsCredited = 0;
  let skippedAlreadyPosted = 0;

  for (const { id } of orders) {
    const before = await prisma.walletTransaction.count({
      where: {
        entryType: "VENDOR_EARNING",
        referenceType: "order",
        referenceId: id,
        direction: "CREDIT",
      },
    });
    await accrueVendorEarningsForCompletedOrder(id);
    const after = await prisma.walletTransaction.count({
      where: {
        entryType: "VENDOR_EARNING",
        referenceType: "order",
        referenceId: id,
        direction: "CREDIT",
      },
    });
    if (after > before) {
      vendorsCredited += after - before;
    } else if (before > 0) {
      skippedAlreadyPosted += before;
    }
  }

  return {
    ordersScanned: orders.length,
    ordersProcessed: orders.length,
    vendorsCredited,
    skippedAlreadyPosted,
  };
}
