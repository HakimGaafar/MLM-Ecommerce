import type { WalletEntryType } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import { week1BusinessRules } from "../business-rules";
import {
  ADMIN_SETTLEABLE_ENTRY_TYPES,
} from "../wallet/wallet-settlement.service";
import {
  scheduleReleaseAllPendingForUser,
  scheduleReleasePendingSettlements,
} from "../wallet/wallet-jobs.service";

export type AdminPendingSettlementDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  entryType: WalletEntryType;
  amount: string;
  currency: string;
  createdAt: string;
  referenceType: string;
  referenceId: string;
  orderId: string | null;
  displaySource: string | null;
  vendorStoreName: string | null;
};

export type AdminReleasedSettlementDto = AdminPendingSettlementDto & {
  releasedAt: string;
  releasedByUserId: string | null;
  releasedByUserName: string | null;
  settlementMethod: string | null;
};

function orderIdFromReference(referenceType: string, referenceId: string): string | null {
  return referenceType === "order" ? referenceId : null;
}

function displaySourceFromMeta(
  entryType: WalletEntryType,
  meta: Record<string, unknown> | null,
): string | null {
  if (!meta) return null;
  if (entryType === "AFFILIATE_COMMISSION") {
    const name = typeof meta.sourceUserName === "string" ? meta.sourceUserName.trim() : "";
    const orderNo = typeof meta.orderNo === "string" ? meta.orderNo.trim() : "";
    const level = meta.level;
    const levelPart =
      typeof level === "number" || typeof level === "string" ? `L${level}` : "";
    const parts = [name ? `From ${name}` : "", levelPart, orderNo ? `Order ${orderNo}` : ""].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  if (entryType === "VENDOR_EARNING") {
    const orderNo = typeof meta.orderNo === "string" ? meta.orderNo.trim() : "";
    return orderNo ? `Order ${orderNo}` : null;
  }
  return null;
}

export async function listAdminPendingSettlements(params: {
  marketId: string;
  userId?: string;
  entryType?: WalletEntryType;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminPendingSettlementDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 5));
  const skip = (page - 1) * pageSize;

  const entryTypes =
    params.entryType && ADMIN_SETTLEABLE_ENTRY_TYPES.includes(params.entryType)
      ? [params.entryType]
      : ADMIN_SETTLEABLE_ENTRY_TYPES;

  const where: Prisma.WalletTransactionWhereInput = {
    status: "PENDING",
    direction: "CREDIT",
    entryType: { in: entryTypes },
    wallet: { marketId: params.marketId },
    ...(params.userId ? { userId: params.userId } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
      include: {
        wallet: { select: { currency: true } },
      },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const [users, vendors] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }),
    prisma.vendor.findMany({
      where: { ownerUserId: { in: userIds } },
      select: { ownerUserId: true, storeName: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const vendorByUserId = new Map(vendors.map((v) => [v.ownerUserId, v.storeName]));

  const items: AdminPendingSettlementDto[] = rows.map((row) => {
    const user = userById.get(row.userId);
    const meta =
      row.metaJson && typeof row.metaJson === "object" && !Array.isArray(row.metaJson)
        ? (row.metaJson as Record<string, unknown>)
        : null;
    return {
      id: row.id,
      userId: row.userId,
      userName: user?.name ?? "—",
      userEmail: user?.email ?? "—",
      entryType: row.entryType,
      amount: row.amount.toString(),
      currency: row.wallet.currency ?? week1BusinessRules.currency,
      createdAt: row.createdAt.toISOString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      orderId: orderIdFromReference(row.referenceType, row.referenceId),
      displaySource: displaySourceFromMeta(row.entryType, meta),
      vendorStoreName: vendorByUserId.get(row.userId) ?? null,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
  };
}

export async function listAdminReleasedSettlements(params: {
  marketId: string;
  userId?: string;
  entryType?: WalletEntryType;
  settledByUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminReleasedSettlementDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const entryTypes =
    params.entryType && ADMIN_SETTLEABLE_ENTRY_TYPES.includes(params.entryType)
      ? [params.entryType]
      : ADMIN_SETTLEABLE_ENTRY_TYPES;

  const where: Prisma.WalletTransactionWhereInput = {
    status: "APPROVED",
    direction: "CREDIT",
    entryType: { in: entryTypes },
    wallet: { marketId: params.marketId },
    ...(params.userId ? { userId: params.userId } : {}),
  };

  const hasMemoryFilters = !!(params.settledByUserId || params.dateFrom || params.dateTo);

  if (!hasMemoryFilters) {
    const [rows, total] = await prisma.$transaction([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { wallet: { select: { currency: true } } },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return await buildReleasedSettlementPage(rows, total, page, pageSize, skip);
  }

  const [allRows] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { wallet: { select: { currency: true } } },
    }),
  ]);

  const filtered = allRows.filter((row) => {
    const meta =
      row.metaJson && typeof row.metaJson === "object" && !Array.isArray(row.metaJson)
        ? (row.metaJson as Record<string, unknown>)
        : null;
    const settledAt =
      typeof meta?.settledAt === "string" ? meta.settledAt : row.updatedAt.toISOString();
    const settledByUserId =
      typeof meta?.settledByUserId === "string" ? meta.settledByUserId : null;

    if (params.settledByUserId && settledByUserId !== params.settledByUserId) {
      return false;
    }
    if (params.dateFrom) {
      const released = new Date(settledAt);
      if (released < params.dateFrom) return false;
    }
    if (params.dateTo) {
      const released = new Date(settledAt);
      if (released > params.dateTo) return false;
    }
    return true;
  });

  const total = filtered.length;
  const rows = filtered.slice(skip, skip + pageSize);

  return await buildReleasedSettlementPage(rows, total, page, pageSize, skip);
}

async function buildReleasedSettlementPage(
  rows: Array<{
    id: string;
    userId: string;
    entryType: WalletEntryType;
    amount: Prisma.Decimal;
    createdAt: Date;
    referenceType: string;
    referenceId: string;
    metaJson: Prisma.JsonValue;
    wallet: { currency: string | null };
  }>,
  total: number,
  page: number,
  pageSize: number,
  skip: number,
) {
  const userIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.userId);
    const meta =
      row.metaJson && typeof row.metaJson === "object" && !Array.isArray(row.metaJson)
        ? (row.metaJson as Record<string, unknown>)
        : null;
    const settledBy =
      typeof meta?.settledByUserId === "string" ? meta.settledByUserId : null;
    if (settledBy) userIds.add(settledBy);
  }

  const [users, vendors] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, email: true },
    }),
    prisma.vendor.findMany({
      where: { ownerUserId: { in: rows.map((r) => r.userId) } },
      select: { ownerUserId: true, storeName: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const vendorByUserId = new Map(vendors.map((v) => [v.ownerUserId, v.storeName]));

  const items: AdminReleasedSettlementDto[] = rows.map((row) => {
    const user = userById.get(row.userId);
    const meta =
      row.metaJson && typeof row.metaJson === "object" && !Array.isArray(row.metaJson)
        ? (row.metaJson as Record<string, unknown>)
        : null;
    const settledAt =
      typeof meta?.settledAt === "string" ? meta.settledAt : row.createdAt.toISOString();
    const settledByUserId =
      typeof meta?.settledByUserId === "string" ? meta.settledByUserId : null;
    const settledBy = settledByUserId ? userById.get(settledByUserId) : undefined;
    const settlementMethod =
      typeof meta?.settlementMethod === "string" ? meta.settlementMethod : null;

    return {
      id: row.id,
      userId: row.userId,
      userName: user?.name ?? "—",
      userEmail: user?.email ?? "—",
      entryType: row.entryType,
      amount: row.amount.toString(),
      currency: row.wallet.currency ?? week1BusinessRules.currency,
      createdAt: row.createdAt.toISOString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      orderId: orderIdFromReference(row.referenceType, row.referenceId),
      displaySource: displaySourceFromMeta(row.entryType, meta),
      vendorStoreName: vendorByUserId.get(row.userId) ?? null,
      releasedAt: settledAt,
      releasedByUserId: settledByUserId,
      releasedByUserName: settledBy?.name ?? null,
      settlementMethod,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
  };
}

export async function adminReleasePendingSettlements(params: {
  transactionIds: string[];
  settledByUserId: string;
}) {
  return scheduleReleasePendingSettlements({
    transactionIds: params.transactionIds,
    settledByUserId: params.settledByUserId,
    method: "manual",
  });
}

export async function adminReleaseAllPendingForUser(params: {
  userId: string;
  settledByUserId: string;
  entryTypes?: WalletEntryType[];
}) {
  return scheduleReleaseAllPendingForUser({
    userId: params.userId,
    settledByUserId: params.settledByUserId,
    entryTypes: params.entryTypes,
    method: "manual",
  });
}
