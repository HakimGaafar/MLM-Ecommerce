import { Prisma, prisma } from "@mlm/db";
import { resolveCommissionSplit } from "../commission/commission-rate.service";
import { getPlatformConfig } from "../platform-config/platform-config.service";
import { getVendorEligibleAmount } from "./vendor-earning.service";
import { ensureWalletInTx } from "./wallet.service";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * When vendor collected COD cash, platform commission is owed as debt (Phase 4).
 * Idempotent per order item. Does not move cash — ledger only.
 */
export async function accrueCommissionDebtForCodOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      subtotal: true,
      discountTotal: true,
      paymentStatus: true,
      paymentMethod: true,
      status: true,
      marketId: true,
      market: { select: { code: true } },
      items: {
        select: {
          id: true,
          vendorId: true,
          lineTotal: true,
          unitLabel: true,
          unitStatus: true,
          vendor: {
            select: { id: true, ownerUserId: true, storeName: true, primaryMarketId: true },
          },
        },
      },
    },
  });

  if (!order) return;
  if (order.paymentMethod !== "COD") return;
  if (order.paymentStatus !== "PAID") return;
  if (order.status === "CANCELLED") return;

  const platformConfig = await getPlatformConfig(order.marketId);
  const orderSubtotal = Number(order.subtotal);
  const orderDiscountTotal = Number(order.discountTotal);

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.unitStatus === "RETURNED") continue;

      const vendorEligibleAmount = getVendorEligibleAmount({
        vendorLineTotal: Number(item.lineTotal),
        orderSubtotal,
        orderDiscountTotal,
      });
      const split = resolveCommissionSplit({
        vendorPrimaryMarketId: item.vendor.primaryMarketId,
        orderMarketId: order.marketId,
        orderMarketCode: order.market.code,
        config: platformConfig,
      });
      const debtAmount = roundMoney(Math.max(vendorEligibleAmount * split.platformRate, 0));
      if (debtAmount <= 0) continue;

      const idempotencyKey = `commission-debt:order:${order.id}:unit:${item.id}`;
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) continue;

      let wallet = await tx.wallet.findUnique({
        where: {
          userId_marketId: { userId: item.vendor.ownerUserId, marketId: order.marketId },
        },
      });
      if (!wallet) {
        wallet = await ensureWalletInTx(tx, item.vendor.ownerUserId, order.marketId);
      }

      const amountDec = new Prisma.Decimal(debtAmount);
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: item.vendor.ownerUserId,
          entryType: "COMMISSION_DEBT",
          direction: "DEBIT",
          amount: amountDec,
          status: "PENDING",
          referenceType: "order",
          referenceId: order.id,
          idempotencyKey,
          metaJson: {
            orderId: order.id,
            orderNo: order.orderNo,
            vendorId: item.vendorId,
            vendorName: item.vendor.storeName,
            orderItemId: item.id,
            unitLabel: item.unitLabel,
            vendorEligibleAmount,
            platformRate: split.platformRate,
            commissionKind: split.kind,
            kind: "cod_commission_debt",
          },
        },
      });
    }
  });
}

/** Admin/system: mark COD commission debt cleared (repaid / netted). */
export async function clearCommissionDebtForOrder(params: {
  orderId: string;
  actorUserId: string;
}): Promise<number> {
  const debts = await prisma.walletTransaction.findMany({
    where: {
      referenceType: "order",
      referenceId: params.orderId,
      entryType: "COMMISSION_DEBT",
      status: "PENDING",
    },
  });
  if (debts.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const debt of debts) {
      await tx.walletTransaction.update({
        where: { id: debt.id },
        data: {
          status: "APPROVED",
          metaJson: {
            ...((debt.metaJson && typeof debt.metaJson === "object" && !Array.isArray(debt.metaJson)
              ? debt.metaJson
              : {}) as Record<string, unknown>),
            clearedAt: new Date().toISOString(),
            clearedByUserId: params.actorUserId,
          },
        },
      });
      const clearKey = `commission-debt-clear:${debt.id}`;
      const exists = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: clearKey },
        select: { id: true },
      });
      if (exists) continue;
      await tx.walletTransaction.create({
        data: {
          walletId: debt.walletId,
          userId: debt.userId,
          entryType: "COMMISSION_DEBT_CLEAR",
          direction: "CREDIT",
          amount: debt.amount,
          status: "APPROVED",
          referenceType: "order",
          referenceId: params.orderId,
          idempotencyKey: clearKey,
          metaJson: {
            clearsTransactionId: debt.id,
            kind: "cod_commission_debt_clear",
            clearedByUserId: params.actorUserId,
          },
        },
      });
    }
  });

  return debts.length;
}
