import { Prisma, prisma } from "@mlm/db";
import { ensureWalletInTx } from "./wallet.service";
import { getPlatformConfig, type PlatformConfigSnapshot } from "../platform-config/platform-config.service";
import type { MissingAncestorPolicy } from "../business-rules";

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
  depth = 4,
): number[] {
  const pool = roundMoney(eligibleAmount * config.affiliatePoolRate);

  return Array.from({ length: depth }, (_, index) =>
    roundMoney(pool * (config.affiliateLevelRates[index] ?? 0)),
  );
}

async function resolveAffiliatePayoutSlots(
  buyerUserId: string,
  maxDepth: number,
): Promise<(string | null)[]> {
  const slots: (string | null)[] = [];
  let childUserId = buyerUserId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const relation = await prisma.referralRelation.findUnique({
      where: { childUserId },
      select: { parentUserId: true },
    });
    if (!relation) {
      slots.push(null);
      break;
    }

    childUserId = relation.parentUserId;
    const parent = await prisma.affiliateProfile.findUnique({
      where: { userId: relation.parentUserId },
      select: { userId: true, isActive: true },
    });
    slots.push(parent?.isActive ? parent.userId : null);
  }

  while (slots.length < maxDepth) slots.push(null);
  return slots.slice(0, maxDepth);
}

function applyMissingAncestorPolicy(params: {
  levelAmounts: number[];
  slots: (string | null)[];
  policy: MissingAncestorPolicy;
}): Array<{ userId: string; amount: number; level: number }> {
  const entries: Array<{ userId: string; amount: number; level: number }> = [];
  let redistributePool = 0;

  for (let index = 0; index < params.levelAmounts.length; index += 1) {
    const amount = params.levelAmounts[index] ?? 0;
    if (amount <= 0) continue;
    const userId = params.slots[index];
    if (userId) {
      entries.push({ userId, amount, level: index + 1 });
    } else if (params.policy === "REDISTRIBUTE_TO_EXISTING_LEVELS") {
      redistributePool = roundMoney(redistributePool + amount);
    }
  }

  if (redistributePool > 0 && entries.length > 0) {
    const share = roundMoney(redistributePool / entries.length);
    for (const entry of entries) {
      entry.amount = roundMoney(entry.amount + share);
    }
  }

  return entries.filter((entry) => entry.amount > 0);
}

/**
 * Walks referral parent chain from buyer upward (max depth levels).
 * Inactive or missing parents are skipped for payout; chain still continues upward.
 */
export async function resolveAffiliateUplineUserIds(
  buyerUserId: string,
  maxDepth = 4,
): Promise<string[]> {
  const slots = await resolveAffiliatePayoutSlots(buyerUserId, maxDepth);
  return slots.filter((id): id is string => Boolean(id));
}

/** Direct (level-1) active referrer of a user, if any. */
export async function resolveDirectReferrerUserId(userId: string): Promise<string | null> {
  const relation = await prisma.referralRelation.findUnique({
    where: { childUserId: userId },
    select: { parentUserId: true },
  });
  if (!relation) return null;

  const parent = await prisma.affiliateProfile.findUnique({
    where: { userId: relation.parentUserId },
    select: { userId: true, isActive: true },
  });
  if (!parent?.isActive) return null;
  return parent.userId;
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
  const depth = Math.min(4, Math.max(1, platformConfig.referralDepthMax));
  const levelAmounts = calculateAffiliateCommissionAmounts(eligibleAmount, platformConfig, depth);
  const slots = await resolveAffiliatePayoutSlots(order.buyerUserId, depth);
  const payouts = applyMissingAncestorPolicy({
    levelAmounts,
    slots,
    policy: platformConfig.missingAncestorPolicy,
  });
  if (payouts.length === 0) return;

  const { affiliatePoolRate } = platformConfig;
  const levelRates = platformConfig.affiliateLevelRates;

  await prisma.$transaction(async (tx) => {
    for (const payout of payouts) {
      let wallet = await tx.wallet.findUnique({
        where: { userId_marketId: { userId: payout.userId, marketId: order.marketId } },
      });
      if (!wallet) {
        wallet = await ensureWalletInTx(tx, payout.userId, order.marketId);
      }

      await postAffiliateCommissionEntry({
        tx,
        walletId: wallet.id,
        userId: payout.userId,
        amount: payout.amount,
        orderId: order.id,
        orderNo: order.orderNo,
        sourceUserId: order.buyerUserId,
        sourceUserName: order.buyer.name,
        level: payout.level,
        eligibleAmount,
        poolRate: affiliatePoolRate,
        levelRate: levelRates[payout.level - 1] ?? 0,
      });
    }
  });
}
