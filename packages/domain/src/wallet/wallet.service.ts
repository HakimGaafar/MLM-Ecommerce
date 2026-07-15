import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import type { LedgerDirection, LedgerStatus, OrderReturnStatus, WalletEntryType } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";
import { getMinWithdrawalAmount, getPlatformConfig } from "../platform-config/platform-config.service";
import { week1BusinessRules } from "../business-rules";
import { getKycStatusSummary } from "../kyc/kyc-document.service";
import {
  markReturnUnitsCompleted,
  recalculateOrderTotalsAfterReturn,
  refreshFinalInvoiceAllowed,
  sumReturnedUnitsLineTotal,
} from "../orders/order-units.service";

export class WalletError extends Error {
  constructor(
    public readonly code: "WALLET_NOT_FOUND" | "ORDER_NOT_ELIGIBLE" | "RETURN_NOT_ELIGIBLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WalletError";
  }
}

export type WalletSummaryDto = {
  marketId: string;
  marketCode: string;
  currency: string;
  availableBalance: string;
  pendingBalance: string;
  lockedBalance: string;
  cashbackRatePercent: number;
  minWithdrawalAmount: string;
  withdrawKycApproved: boolean;
  withdrawIdExpired: boolean;
  /** Non-active markets where the user has any wallet balance. */
  otherMarkets: WalletOtherMarketBalanceDto[];
};

export type WalletOtherMarketBalanceDto = {
  marketId: string;
  marketCode: string;
  marketName: string;
  currency: string;
  availableBalance: string;
};

export type WalletTransactionDto = {
  id: string;
  entryType: WalletEntryType;
  direction: LedgerDirection;
  amount: string;
  status: LedgerStatus;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
  /** Human-readable line for affiliate commission rows (referred customer + level + order). */
  displaySource: string | null;
};

type WalletListLocale = "en" | "ar";

function formatAffiliateCommissionDisplaySource(
  meta: Record<string, unknown> | null,
  fallback: { buyerName: string; orderNo: string; level: number } | null,
  locale: WalletListLocale,
): string | null {
  const levelRaw = meta?.level ?? fallback?.level;
  const level = typeof levelRaw === "number" ? levelRaw : Number(levelRaw);
  const name =
    (typeof meta?.sourceUserName === "string" && meta.sourceUserName.trim()) ||
    fallback?.buyerName ||
    null;
  const orderNo =
    (typeof meta?.orderNo === "string" && meta.orderNo.trim()) || fallback?.orderNo || null;

  if (!name && !orderNo && !Number.isFinite(level)) return null;

  const customer = name ?? (locale === "ar" ? "عميل" : "Customer");
  const levelPart = Number.isFinite(level)
    ? locale === "ar"
      ? `المستوى ${level}`
      : `Level ${level}`
    : null;
  const orderPart = orderNo
    ? locale === "ar"
      ? `الطلب ${orderNo}`
      : `Order ${orderNo}`
    : null;

  return [locale === "ar" ? `من ${customer}` : `From ${customer}`, levelPart, orderPart]
    .filter(Boolean)
    .join(locale === "ar" ? " · " : " · ");
}

async function loadOrderFallbacksForAffiliateRows(
  orderIds: string[],
): Promise<Map<string, { buyerName: string; orderNo: string; level: number }>> {
  if (orderIds.length === 0) return new Map();

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNo: true, buyer: { select: { name: true } } },
  });

  return new Map(
    orders.map((order) => [
      order.id,
      { buyerName: order.buyer.name, orderNo: order.orderNo, level: 1 },
    ]),
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function resolveWalletCurrency(marketId: string): Promise<string> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { defaultCurrency: true },
  });
  return market?.defaultCurrency ?? week1BusinessRules.currency;
}

export async function ensureWallet(userId: string, marketId: string = DEFAULT_MARKET_ID) {
  const currency = await resolveWalletCurrency(marketId);
  const where = { userId_marketId: { userId, marketId } };
  return raceSafeUpsert({
    upsert: () =>
      prisma.wallet.upsert({
        where,
        create: { userId, marketId, currency },
        update: {},
      }),
    findUnique: () => prisma.wallet.findUnique({ where }),
  });
}

export async function ensureWalletInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  marketId: string,
) {
  const currency = await resolveWalletCurrency(marketId);
  const where = { userId_marketId: { userId, marketId } };
  return raceSafeUpsert({
    upsert: () =>
      tx.wallet.upsert({
        where,
        create: { userId, marketId, currency },
        update: {},
      }),
    findUnique: () => tx.wallet.findUnique({ where }),
  });
}

async function listOtherMarketWalletBalances(
  userId: string,
  activeMarketId: string,
): Promise<WalletOtherMarketBalanceDto[]> {
  const rows = await prisma.wallet.findMany({
    where: {
      userId,
      marketId: { not: activeMarketId },
      OR: [
        { availableBalance: { gt: 0 } },
        { pendingBalance: { gt: 0 } },
        { lockedBalance: { gt: 0 } },
      ],
    },
    include: {
      market: { select: { code: true, nameEn: true, nameAr: true } },
    },
    orderBy: { market: { sortOrder: "asc" } },
  });

  return rows.map((row) => ({
    marketId: row.marketId,
    marketCode: row.market.code,
    marketName: row.market.nameEn,
    currency: row.currency,
    availableBalance: row.availableBalance.toString(),
  }));
}

export async function getWalletSummary(userId: string, marketId: string = DEFAULT_MARKET_ID): Promise<WalletSummaryDto> {
  const [wallet, kyc, platformConfig, minWithdrawal, market, otherMarkets] = await Promise.all([
    ensureWallet(userId, marketId),
    getKycStatusSummary({ subjectType: "CUSTOMER", userId }),
    getPlatformConfig(marketId),
    getMinWithdrawalAmount(marketId),
    prisma.market.findUnique({
      where: { id: marketId },
      select: { code: true },
    }),
    listOtherMarketWalletBalances(userId, marketId),
  ]);
  return {
    marketId,
    marketCode: market?.code ?? "SA",
    currency: wallet.currency,
    availableBalance: wallet.availableBalance.toString(),
    pendingBalance: wallet.pendingBalance.toString(),
    lockedBalance: wallet.lockedBalance.toString(),
    cashbackRatePercent: Math.round(platformConfig.cashbackRate * 1000) / 10,
    minWithdrawalAmount: minWithdrawal.toFixed(2),
    withdrawKycApproved: kyc.approved,
    withdrawIdExpired: kyc.idExpired,
    otherMarkets,
  };
}

export async function listWalletTransactionsForUser(params: {
  userId: string;
  marketId?: string;
  page: number;
  pageSize: number;
  locale?: WalletListLocale;
  entryType?: WalletEntryType;
}): Promise<{
  items: WalletTransactionDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const wallet = await ensureWallet(params.userId, params.marketId ?? DEFAULT_MARKET_ID);

  const locale = params.locale ?? "en";
  const where = {
    walletId: wallet.id,
    ...(params.entryType ? { entryType: params.entryType } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  const affiliateOrderIds = rows
    .filter((tx) => tx.entryType === "AFFILIATE_COMMISSION" && tx.referenceType === "order")
    .map((tx) => tx.referenceId);
  const orderFallbacks = await loadOrderFallbacksForAffiliateRows(affiliateOrderIds);

  const items: WalletTransactionDto[] = rows.map((tx) => {
    const meta = tx.metaJson as Record<string, unknown> | null;
    const orderFallback =
      tx.entryType === "AFFILIATE_COMMISSION" && tx.referenceType === "order"
        ? orderFallbacks.get(tx.referenceId) ?? null
        : null;
    const levelFromMeta =
      typeof meta?.level === "number"
        ? meta.level
        : typeof meta?.level === "string"
          ? Number(meta.level)
          : NaN;
    const enrichedFallback: { buyerName: string; orderNo: string; level: number } | null = orderFallback
      ? {
          buyerName: orderFallback.buyerName,
          orderNo:
            (typeof meta?.orderNo === "string" && meta.orderNo.trim()) || orderFallback.orderNo,
          level: Number.isFinite(levelFromMeta) ? levelFromMeta : orderFallback.level,
        }
      : Number.isFinite(levelFromMeta)
        ? {
            buyerName:
              (typeof meta?.sourceUserName === "string" && meta.sourceUserName.trim()) || "",
            orderNo: (typeof meta?.orderNo === "string" && meta.orderNo.trim()) || "",
            level: levelFromMeta,
          }
        : null;
    const displaySource =
      tx.entryType === "AFFILIATE_COMMISSION"
        ? formatAffiliateCommissionDisplaySource(meta, enrichedFallback, locale)
        : null;

    return {
      id: tx.id,
      entryType: tx.entryType,
      direction: tx.direction,
      amount: tx.amount.toString(),
      status: tx.status,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
      meta,
      displaySource,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

async function applyBalanceDelta(
  tx: Prisma.TransactionClient,
  walletId: string,
  direction: LedgerDirection,
  amount: Prisma.Decimal,
  status: LedgerStatus,
) {
  if (status === "APPROVED") {
    const delta = direction === "CREDIT" ? amount : amount.mul(-1);
    await tx.wallet.update({
      where: { id: walletId },
      data: { availableBalance: { increment: delta } },
    });
    return;
  }

  if (status === "PENDING") {
    const delta = direction === "CREDIT" ? amount : amount.mul(-1);
    await tx.wallet.update({
      where: { id: walletId },
      data: { pendingBalance: { increment: delta } },
    });
  }
}

/** Reverses per-level affiliate commission credits for an order (idempotent per return + level). */
async function markAffiliateAccrualReversed(
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
        kind: priorMeta.kind ?? "affiliate_commission_accrual",
      },
    },
  });
}

/**
 * When an accrual was released to available after a PENDING reversal was posted,
 * finalize the reversal debit against available so balances stay correct.
 */
async function reconcileAffiliateReversalBalance(
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

async function reverseAffiliateCommissionsForOrderInTx(params: {
  tx: Prisma.TransactionClient;
  orderId: string;
  orderReturnId: string;
  orderNo: string;
  reversalRatio?: number;
}): Promise<void> {
  const depth = week1BusinessRules.referralDepthMax;
  const ratio = Math.min(1, Math.max(0, params.reversalRatio ?? 1));

  for (let level = 1; level <= depth; level += 1) {
    const accrualKey = `affiliate:order:${params.orderId}:level:${level}`;
    const prior = await params.tx.walletTransaction.findUnique({
      where: { idempotencyKey: accrualKey },
    });
    if (
      !prior ||
      prior.entryType !== "AFFILIATE_COMMISSION" ||
      prior.direction !== "CREDIT" ||
      (prior.status !== "PENDING" && prior.status !== "APPROVED")
    ) {
      continue;
    }

    const priorMeta = prior.metaJson as Record<string, unknown> | null;
    const sourceUserId =
      typeof priorMeta?.sourceUserId === "string" ? priorMeta.sourceUserId : undefined;
    const sourceUserName =
      typeof priorMeta?.sourceUserName === "string" ? priorMeta.sourceUserName : undefined;

    const reversalKey = `affiliate-reversal:return:${params.orderReturnId}:level:${level}`;
    const existingReversal = await params.tx.walletTransaction.findUnique({
      where: { idempotencyKey: reversalKey },
    });
    if (existingReversal) {
      await markAffiliateAccrualReversed(params.tx, prior, params.orderReturnId);
      await reconcileAffiliateReversalBalance(params.tx, prior, existingReversal);
      continue;
    }

    await postLedgerEntry({
      tx: params.tx,
      walletId: prior.walletId,
      userId: prior.userId,
      entryType: "AFFILIATE_COMMISSION",
      direction: "DEBIT",
      amount: roundMoney(Number(prior.amount) * ratio),
      status: prior.status,
      referenceType: "order_return",
      referenceId: params.orderReturnId,
      idempotencyKey: reversalKey,
      metaJson: {
        orderId: params.orderId,
        orderNo: params.orderNo,
        orderReturnId: params.orderReturnId,
        level,
        ...(sourceUserId ? { sourceUserId } : {}),
        ...(sourceUserName ? { sourceUserName } : {}),
        reversedTransactionId: prior.id,
        kind: "affiliate_commission_reversal",
        reason: "refund_completed",
      },
    });

    const reversal = await params.tx.walletTransaction.findUnique({
      where: { idempotencyKey: reversalKey },
    });
    if (!reversal) continue;

    await markAffiliateAccrualReversed(params.tx, prior, params.orderReturnId);
    await reconcileAffiliateReversalBalance(params.tx, prior, reversal);
  }
}

async function postLedgerEntry(params: {
  tx: Prisma.TransactionClient;
  walletId: string;
  userId: string;
  entryType: WalletEntryType;
  direction: LedgerDirection;
  amount: number;
  status: LedgerStatus;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metaJson?: Prisma.InputJsonValue;
}): Promise<{ created: boolean; transactionId: string }> {
  const existing = await params.tx.walletTransaction.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { created: false, transactionId: existing.id };
  }

  const amountDec = new Prisma.Decimal(roundMoney(params.amount));
  const row = await params.tx.walletTransaction.create({
    data: {
      walletId: params.walletId,
      userId: params.userId,
      entryType: params.entryType,
      direction: params.direction,
      amount: amountDec,
      status: params.status,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      idempotencyKey: params.idempotencyKey,
      metaJson: params.metaJson ?? undefined,
    },
  });

  await applyBalanceDelta(params.tx, params.walletId, params.direction, amountDec, params.status);
  return { created: true, transactionId: row.id };
}

import {
  accrueAffiliateCommissionsForCompletedOrder,
  getAffiliateEligibleOrderAmount,
} from "./affiliate-commission.service";
import {
  accrueVendorEarningsForCompletedOrder,
  reverseVendorEarningsForOrderInTx,
} from "./vendor-earning.service";

/**
 * Runs buyer cashback + affiliate commission + vendor earning accrual when order is COMPLETED and PAID.
 */
export async function finalizeOrderRewards(orderId: string): Promise<void> {
  await accrueCashbackForCompletedOrder(orderId);
  await accrueAffiliateCommissionsForCompletedOrder(orderId);
  await accrueVendorEarningsForCompletedOrder(orderId);
}

/**
 * Credits cashback when an order is marked COMPLETED and PAID.
 * Idempotent per order.
 */
export async function accrueCashbackForCompletedOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerUserId: true,
      subtotal: true,
      discountTotal: true,
      paymentStatus: true,
      status: true,
      marketId: true,
    },
  });
  if (!order || order.status !== "COMPLETED" || order.paymentStatus !== "PAID") {
    return;
  }

  const eligibleAmount = getAffiliateEligibleOrderAmount(order);
  const platformConfig = await getPlatformConfig(order.marketId);
  const rate = platformConfig.cashbackRate;
  const amount = roundMoney(eligibleAmount * rate);
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const wallet = await ensureWalletInTx(tx, order.buyerUserId, order.marketId);

    await postLedgerEntry({
      tx,
      walletId: wallet.id,
      userId: order.buyerUserId,
      entryType: "CASHBACK",
      direction: "CREDIT",
      amount,
      status: "APPROVED",
      referenceType: "order",
      referenceId: order.id,
      idempotencyKey: `cashback:order:${order.id}`,
      metaJson: {
        orderId: order.id,
        rate,
        eligibleAmount,
        kind: "cashback_accrual",
      },
    });
  });
}

/**
 * On return REFUND_COMPLETED: reverse prior cashback and affiliate commissions (if any),
 * credit refund to wallet, mark order REFUNDED. Idempotent per return.
 */
export async function processReturnRefund(returnId: string): Promise<void> {
  const ret = await prisma.orderReturn.findUnique({
    where: { id: returnId },
    include: {
      returnUnits: { select: { id: true } },
      order: {
        select: {
          id: true,
          buyerUserId: true,
          marketId: true,
          subtotal: true,
          shippingFee: true,
          discountTotal: true,
          vatTotal: true,
          totalAmount: true,
          paymentStatus: true,
          orderNo: true,
          items: { select: { id: true, unitStatus: true } },
        },
      },
    },
  });
  if (!ret || ret.status !== "REFUND_COMPLETED") {
    throw new WalletError("RETURN_NOT_ELIGIBLE", "Return must be REFUND_COMPLETED.");
  }

  const returnedUnitIds = ret.returnUnits.map((u) => u.id);
  const returnedMerchFromUnits = await sumReturnedUnitsLineTotal(returnId);
  const orderSubtotal = Number(ret.order.subtotal);
  // Pre–Phase II returns have no linked units — treat as a full-order refund.
  const hasLinkedUnits = returnedUnitIds.length > 0;
  const returnedMerch = hasLinkedUnits ? returnedMerchFromUnits : orderSubtotal;
  const ratio = orderSubtotal > 0 ? Math.min(1, returnedMerch / orderSubtotal) : 1;

  const shippingShare = roundMoney(Number(ret.order.shippingFee) * ratio);
  const discountShare = roundMoney(Number(ret.order.discountTotal) * ratio);
  const vatShare = roundMoney(Number(ret.order.vatTotal) * ratio);
  const refundAmount = roundMoney(returnedMerch + shippingShare - discountShare + vatShare);
  if (refundAmount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const wallet = await ensureWalletInTx(tx, ret.buyerUserId, ret.order.marketId);

    const cashbackKey = `cashback:order:${ret.orderId}`;
    const priorCashback = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: cashbackKey },
    });
    if (priorCashback && priorCashback.status === "APPROVED" && priorCashback.direction === "CREDIT") {
      await postLedgerEntry({
        tx,
        walletId: wallet.id,
        userId: ret.buyerUserId,
        entryType: "CASHBACK",
        direction: "DEBIT",
        amount: roundMoney(Number(priorCashback.amount) * ratio),
        status: "APPROVED",
        referenceType: "order_return",
        referenceId: ret.id,
        idempotencyKey: `cashback-reversal:return:${ret.id}`,
        metaJson: { orderId: ret.orderId, orderReturnId: ret.id, reason: "refund_completed", ratio },
      });
    }

    await reverseAffiliateCommissionsForOrderInTx({
      tx,
      orderId: ret.orderId,
      orderReturnId: ret.id,
      orderNo: ret.order.orderNo,
      reversalRatio: ratio,
    });

    await reverseVendorEarningsForOrderInTx({
      tx,
      orderId: ret.orderId,
      orderReturnId: ret.id,
      orderNo: ret.order.orderNo,
      unitIds: returnedUnitIds,
    });

    await postLedgerEntry({
      tx,
      walletId: wallet.id,
      userId: ret.buyerUserId,
      entryType: "ADJUSTMENT",
      direction: "CREDIT",
      amount: refundAmount,
      status: "APPROVED",
      referenceType: "order_return",
      referenceId: ret.id,
      idempotencyKey: `refund:return:${ret.id}`,
      metaJson: {
        orderId: ret.orderId,
        orderNo: ret.order.orderNo,
        orderReturnId: ret.id,
        returnedUnitIds,
        kind: "order_refund",
      },
    });

    await markReturnUnitsCompleted(returnId, tx);

    const remainingActive = await tx.orderItem.count({
      where: { orderId: ret.orderId, unitStatus: "ACTIVE" },
    });

    if (remainingActive === 0 && ret.order.paymentStatus !== "REFUNDED") {
      await tx.order.update({
        where: { id: ret.orderId },
        data: { paymentStatus: "REFUNDED" },
      });
    }
  });

  await recalculateOrderTotalsAfterReturn(ret.orderId);
  await refreshFinalInvoiceAllowed(ret.orderId);
}

/** Called after admin updates return status — runs refund ledger when entering REFUND_COMPLETED. */
export async function onAdminReturnStatusChanged(
  returnId: string,
  nextStatus: OrderReturnStatus,
): Promise<void> {
  if (nextStatus === "REFUND_COMPLETED") {
    await processReturnRefund(returnId);
  }
}
