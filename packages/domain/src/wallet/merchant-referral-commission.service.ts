import { Prisma, prisma } from "@mlm/db";
import {
  calculateAffiliateCommissionAmounts,
  resolveDirectReferrerUserId,
} from "./affiliate-commission.service";
import { getVendorEligibleAmount } from "./vendor-earning.service";
import { ensureWalletInTx } from "./wallet.service";
import { getPlatformConfig } from "../platform-config/platform-config.service";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function postMerchantReferralEntry(params: {
  tx: Prisma.TransactionClient;
  walletId: string;
  userId: string;
  amount: number;
  orderId: string;
  orderNo: string;
  vendorId: string;
  vendorName: string;
  vendorOwnerUserId: string;
  vendorOwnerName: string;
  vendorEligibleAmount: number;
  poolRate: number;
  levelRate: number;
}): Promise<boolean> {
  const idempotencyKey = `merchant-referral:order:${params.orderId}:vendor:${params.vendorId}:level:1`;
  const existing = await params.tx.walletTransaction.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return false;

  const amountDec = new Prisma.Decimal(params.amount);
  await params.tx.walletTransaction.create({
    data: {
      walletId: params.walletId,
      userId: params.userId,
      entryType: "AFFILIATE_COMMISSION",
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
        sourceUserId: params.vendorOwnerUserId,
        sourceUserName: params.vendorOwnerName,
        level: 1,
        eligibleAmount: params.vendorEligibleAmount,
        affiliatePoolRate: params.poolRate,
        levelRate: params.levelRate,
        kind: "merchant_referral_accrual",
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
 * Pays the direct referrer when a referred merchant's store completes a paid order.
 * Uses the same affiliate pool + level-1 rate applied to each vendor's eligible line total.
 */
export async function accrueMerchantReferralCommissionsForCompletedOrder(orderId: string): Promise<void> {
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
          vendorId: true,
          lineTotal: true,
          unitStatus: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              ownerUserId: true,
              owner: { select: { name: true } },
            },
          },
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
  const { affiliatePoolRate } = platformConfig;
  const levelRate = platformConfig.affiliateLevelRates[0] ?? 0;

  const vendorTotals = new Map<
    string,
    { vendorEligibleAmount: number; vendorName: string; ownerUserId: string; ownerName: string }
  >();

  for (const item of order.items) {
    if (item.unitStatus === "RETURNED") continue;
    const vendorLineTotal = Number(item.lineTotal);
    const vendorEligibleAmount = getVendorEligibleAmount({
      vendorLineTotal,
      orderSubtotal,
      orderDiscountTotal,
    });
    if (vendorEligibleAmount <= 0) continue;

    const existing = vendorTotals.get(item.vendorId);
    if (existing) {
      existing.vendorEligibleAmount = roundMoney(existing.vendorEligibleAmount + vendorEligibleAmount);
      continue;
    }
    vendorTotals.set(item.vendorId, {
      vendorEligibleAmount,
      vendorName: item.vendor.storeName,
      ownerUserId: item.vendor.ownerUserId,
      ownerName: item.vendor.owner.name,
    });
  }

  if (vendorTotals.size === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [vendorId, vendor] of vendorTotals) {
      const referrerUserId = await resolveDirectReferrerUserId(vendor.ownerUserId);
      if (!referrerUserId) continue;

      const levelAmounts = calculateAffiliateCommissionAmounts(
        vendor.vendorEligibleAmount,
        platformConfig,
      );
      const amount = levelAmounts[0] ?? 0;
      if (amount <= 0) continue;

      let wallet = await tx.wallet.findUnique({
        where: { userId_marketId: { userId: referrerUserId, marketId: order.marketId } },
      });
      if (!wallet) {
        wallet = await ensureWalletInTx(tx, referrerUserId, order.marketId);
      }

      await postMerchantReferralEntry({
        tx,
        walletId: wallet.id,
        userId: referrerUserId,
        amount,
        orderId: order.id,
        orderNo: order.orderNo,
        vendorId,
        vendorName: vendor.vendorName,
        vendorOwnerUserId: vendor.ownerUserId,
        vendorOwnerName: vendor.ownerName,
        vendorEligibleAmount: vendor.vendorEligibleAmount,
        poolRate: affiliatePoolRate,
        levelRate,
      });
    }
  });
}

export async function reverseMerchantReferralCommissionsForOrderInTx(params: {
  tx: Prisma.TransactionClient;
  orderId: string;
  orderReturnId: string;
  orderNo: string;
  reversalRatio?: number;
}): Promise<void> {
  const ratio = Math.min(1, Math.max(0, params.reversalRatio ?? 1));
  const accruals = await params.tx.walletTransaction.findMany({
    where: {
      entryType: "AFFILIATE_COMMISSION",
      direction: "CREDIT",
      referenceType: "order",
      referenceId: params.orderId,
      idempotencyKey: { startsWith: `merchant-referral:order:${params.orderId}:vendor:` },
    },
  });

  for (const prior of accruals) {
    if (prior.status !== "PENDING" && prior.status !== "APPROVED") continue;

    const meta = prior.metaJson as Record<string, unknown> | null;
    const vendorId = typeof meta?.vendorId === "string" ? meta.vendorId : "unknown";
    const reversalKey = `merchant-referral-reversal:return:${params.orderReturnId}:vendor:${vendorId}`;
    const existing = await params.tx.walletTransaction.findUnique({
      where: { idempotencyKey: reversalKey },
    });
    if (existing) continue;

    const reversalAmount = roundMoney(Number(prior.amount) * ratio);
    const amountDec = new Prisma.Decimal(reversalAmount);

    await params.tx.walletTransaction.create({
      data: {
        walletId: prior.walletId,
        userId: prior.userId,
        entryType: "AFFILIATE_COMMISSION",
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
          reversedTransactionId: prior.id,
          kind: "merchant_referral_reversal",
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
    } else {
      await params.tx.wallet.update({
        where: { id: prior.walletId },
        data: { pendingBalance: { increment: delta } },
      });
    }

    await params.tx.walletTransaction.update({
      where: { id: prior.id },
      data: {
        status: "REVERSED",
        metaJson: {
          ...(meta ?? {}),
          reversedAt: new Date().toISOString(),
          orderReturnId: params.orderReturnId,
          kind: meta?.kind ?? "merchant_referral_accrual",
        },
      },
    });
  }
}
