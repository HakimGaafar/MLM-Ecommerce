import { Prisma, prisma } from "@mlm/db";
import { ensureWalletInTx } from "./wallet.service";
import { week1BusinessRules } from "../business-rules";
import { getPlatformConfig, type PlatformConfigSnapshot } from "../platform-config/platform-config.service";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Product value basis: subtotal minus discounts (excludes shipping and VAT). */
export function getAffiliateEligibleOrderAmount(order: {
  subtotal: Prisma.Decimal | { toString(): string };
  discountTotal: Prisma.Decimal | { toString(): string };
}): number {
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discountTotal);
  return roundMoney(Math.max(subtotal - discount, 0));
}

export function calculateAffiliateCommissionAmounts(
  eligibleAmount: number,
  config: Pick<PlatformConfigSnapshot, "affiliatePoolRate" | "affiliateLevelRates">,
  depth = week1BusinessRules.referralDepthMax,
): number[] {
  const pool = roundMoney(eligibleAmount * config.affiliatePoolRate);

  return Array.from({ length: depth }, (_, index) =>
    roundMoney(pool * (config.affiliateLevelRates[index] ?? 0)),
  );
}

/**
 * Walks referral parent chain from buyer upward (max 4 levels).
 * Inactive or missing parents are skipped for payout; chain still continues upward.
 */
export async function resolveAffiliateUplineUserIds(
  buyerUserId: string,
  maxDepth = week1BusinessRules.referralDepthMax,
): Promise<string[]> {
  const uplines: string[] = [];
  let childUserId = buyerUserId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const relation = await prisma.referralRelation.findUnique({
      where: { childUserId },
      select: { parentUserId: true },
    });
    if (!relation) break;

    childUserId = relation.parentUserId;

    const parent = await prisma.affiliateProfile.findUnique({
      where: { userId: relation.parentUserId },
      select: { userId: true, isActive: true },
    });
    if (!parent?.isActive) continue;

    uplines.push(parent.userId);
  }

  return uplines;
}

async function postAffiliateCommissionEntry(params: {
  tx: Prisma.TransactionClient;
  walletId: string;
  userId: string;
  amount: number;
  orderId: string;
  orderNo: string;
  sourceUserId: string;
  sourceUserName: string;
  level: number;
  eligibleAmount: number;
  poolRate: number;
  levelRate: number;
}): Promise<boolean> {
  const idempotencyKey = `affiliate:order:${params.orderId}:level:${params.level}`;
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
        sourceUserId: params.sourceUserId,
        sourceUserName: params.sourceUserName,
        level: params.level,
        eligibleAmount: params.eligibleAmount,
        affiliatePoolRate: params.poolRate,
        levelRate: params.levelRate,
        kind: "affiliate_commission_accrual",
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
 * Option A (locked): global referral tree; upline commissions credit the wallet
 * for the order's market using that market's platform config rates.
 */
export async function accrueAffiliateCommissionsForCompletedOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      buyerUserId: true,
      subtotal: true,
      discountTotal: true,
      paymentStatus: true,
      status: true,
      marketId: true,
      buyer: { select: { name: true } },
    },
  });
  if (!order || order.status !== "COMPLETED" || order.paymentStatus !== "PAID") {
    return;
  }

  const eligibleAmount = getAffiliateEligibleOrderAmount(order);
  if (eligibleAmount <= 0) return;

  const platformConfig = await getPlatformConfig(order.marketId);
  const levelAmounts = calculateAffiliateCommissionAmounts(eligibleAmount, platformConfig);
  const uplines = await resolveAffiliateUplineUserIds(order.buyerUserId);
  if (uplines.length === 0) return;

  const { affiliatePoolRate } = platformConfig;
  const levelRates = platformConfig.affiliateLevelRates;

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < levelAmounts.length; index += 1) {
      const amount = levelAmounts[index] ?? 0;
      const uplineUserId = uplines[index];
      if (!uplineUserId || amount <= 0) continue;

      let wallet = await tx.wallet.findUnique({
        where: { userId_marketId: { userId: uplineUserId, marketId: order.marketId } },
      });
      if (!wallet) {
        wallet = await ensureWalletInTx(tx, uplineUserId, order.marketId);
      }

      await postAffiliateCommissionEntry({
        tx,
        walletId: wallet.id,
        userId: uplineUserId,
        amount,
        orderId: order.id,
        orderNo: order.orderNo,
        sourceUserId: order.buyerUserId,
        sourceUserName: order.buyer.name,
        level: index + 1,
        eligibleAmount,
        poolRate: affiliatePoolRate,
        levelRate: levelRates[index] ?? 0,
      });
    }
  });
}
