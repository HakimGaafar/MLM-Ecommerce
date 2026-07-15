import type { LedgerDirection, LedgerStatus, Prisma, WalletEntryType } from "@mlm/db";
import { prisma } from "@mlm/db";
import { ensureWallet, ensureWalletInTx, getWalletSummary, type WalletSummaryDto } from "../wallet/wallet.service";

export type VendorWalletTransactionDto = {
  id: string;
  entryType: WalletEntryType;
  direction: LedgerDirection;
  amount: string;
  status: LedgerStatus;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

const VENDOR_LEDGER_TYPES: WalletEntryType[] = ["VENDOR_EARNING", "WITHDRAWAL", "ADJUSTMENT", "ORDER_PAYMENT"];

export async function getVendorWalletSummary(
  ownerUserId: string,
  marketId: string,
): Promise<WalletSummaryDto> {
  return getWalletSummary(ownerUserId, marketId);
}

export async function listVendorWalletLedger(params: {
  ownerUserId: string;
  marketId: string;
  kind: "pay_in" | "payout";
  page: number;
  pageSize: number;
}): Promise<{
  items: VendorWalletTransactionDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const wallet = await ensureWallet(params.ownerUserId, params.marketId);

  const directionFilter =
    params.kind === "pay_in"
      ? { direction: "CREDIT" as const }
      : { direction: "DEBIT" as const };

  const where = {
    walletId: wallet.id,
    entryType: { in: VENDOR_LEDGER_TYPES },
    ...directionFilter,
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

  const items: VendorWalletTransactionDto[] = rows.map((tx) => ({
    id: tx.id,
    entryType: tx.entryType,
    direction: tx.direction,
    amount: tx.amount.toString(),
    status: tx.status,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
    meta: tx.metaJson as Record<string, unknown> | null,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

const STATUS_FILTER_MAP: Record<string, LedgerStatus> = {
  pending: "PENDING",
  approved: "APPROVED",
  declined: "DECLINED",
  reversed: "REVERSED",
};

function parseYmdUtcStart(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYmdUtcEnd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildVendorOperationsWhere(
  walletId: string,
  filters: {
    directionFilter: string;
    statusFilter: string;
    dateRange: string;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): Prisma.WalletTransactionWhereInput {
  const where: Prisma.WalletTransactionWhereInput = {
    walletId,
    entryType: { in: VENDOR_LEDGER_TYPES },
  };

  const normalizedDirection = filters.directionFilter.trim().toLowerCase();
  if (normalizedDirection === "credit") {
    where.direction = "CREDIT";
  } else if (normalizedDirection === "debit") {
    where.direction = "DEBIT";
  }

  const normalizedStatus = filters.statusFilter.trim().toLowerCase();
  if (normalizedStatus !== "all") {
    const mapped = STATUS_FILTER_MAP[normalizedStatus];
    if (mapped) {
      where.status = mapped;
    }
  }

  const fromParam = filters.dateFrom?.trim() ?? "";
  const toParam = filters.dateTo?.trim() ?? "";
  if (fromParam && toParam) {
    const start = parseYmdUtcStart(fromParam);
    const end = parseYmdUtcEnd(toParam);
    if (start && end && start <= end) {
      const spanMs = end.getTime() - start.getTime();
      const maxSpan = 366 * 24 * 60 * 60 * 1000;
      if (spanMs <= maxSpan) {
        where.createdAt = { gte: start, lte: end };
      }
    }
  } else {
    const normalizedRange = filters.dateRange.trim().toLowerCase();
    if (normalizedRange !== "all" && normalizedRange !== "custom") {
      const days = Number.parseInt(normalizedRange, 10);
      if (!Number.isNaN(days) && days > 0) {
        const from = new Date();
        from.setUTCDate(from.getUTCDate() - days);
        from.setUTCHours(0, 0, 0, 0);
        where.createdAt = { gte: from };
      }
    }
  }

  return where;
}

export async function listVendorOperationsLedger(params: {
  ownerUserId: string;
  marketId: string;
  directionFilter: string;
  statusFilter: string;
  dateRange: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
}): Promise<{
  items: VendorWalletTransactionDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const wallet = await ensureWallet(params.ownerUserId, params.marketId);

  const where = buildVendorOperationsWhere(wallet.id, params);

  const [rows, total] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  const items: VendorWalletTransactionDto[] = rows.map((tx) => ({
    id: tx.id,
    entryType: tx.entryType,
    direction: tx.direction,
    amount: tx.amount.toString(),
    status: tx.status,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
    meta: tx.metaJson as Record<string, unknown> | null,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}
