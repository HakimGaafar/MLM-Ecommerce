import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { Prisma, prisma } from "@mlm/db";
import { AffiliateWithdrawalError } from "../wallet/affiliate-withdrawal.service";

export type AdminWithdrawalDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: string;
  currency: string;
  direction: string;
  status: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  paidAt: string | null;
  bankReference: string | null;
};

export class AdminWithdrawalError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_PENDING" | "INVALID_ACTION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminWithdrawalError";
  }
}

function mapRow(tx: {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  direction: string;
  status: string;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
  metaJson: unknown;
  wallet: { currency: string; user: { name: string; email: string } };
}): AdminWithdrawalDto {
  const meta = tx.metaJson as Record<string, unknown> | null;
  const paidAt = typeof meta?.paidAt === "string" ? meta.paidAt : null;
  const bankReference = typeof meta?.bankReference === "string" ? meta.bankReference : null;
  return {
    id: tx.id,
    userId: tx.userId,
    userName: tx.wallet.user.name,
    userEmail: tx.wallet.user.email,
    amount: tx.amount.toString(),
    currency: tx.wallet.currency,
    direction: tx.direction,
    status: tx.status,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
    paidAt,
    bankReference,
  };
}

export async function listAdminWithdrawals(params: {
  marketId: string;
  page?: number;
  pageSize?: number;
  status?: "PENDING" | "APPROVED" | "DECLINED";
  scope?: "affiliate" | "all";
}): Promise<PaginatedResult<AdminWithdrawalDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const referenceFilter =
    params.scope === "affiliate"
      ? { referenceType: "affiliate_withdrawal" }
      : params.scope === "all"
        ? {}
        : { referenceType: "affiliate_withdrawal" };

  const where = {
    entryType: "WITHDRAWAL" as const,
    wallet: { marketId: params.marketId },
    ...(params.status ? { status: params.status } : { status: "PENDING" as const }),
    ...referenceFilter,
  };

  const [rows, total] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take,
      include: {
        wallet: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return buildPaginatedResult(rows.map(mapRow), total, page, pageSize);
}

/** @deprecated Use listAdminWithdrawals */
export async function listAdminPendingWithdrawals(params: {
  marketId: string;
  page?: number;
  pageSize?: number;
}) {
  return listAdminWithdrawals({ ...params, status: "PENDING", scope: "all" });
}

export async function approveAdminWithdrawal(
  transactionId: string,
  actorUserId?: string,
): Promise<AdminWithdrawalDto> {
  const tx = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: { include: { user: { select: { name: true, email: true } } } } },
  });
  if (!tx || tx.entryType !== "WITHDRAWAL") {
    throw new AdminWithdrawalError("NOT_FOUND", "Withdrawal not found.");
  }
  if (tx.status !== "PENDING") {
    throw new AdminWithdrawalError("NOT_PENDING", "Withdrawal is not pending.");
  }

  const updated = await prisma.walletTransaction.update({
    where: { id: transactionId },
    data: {
      status: "APPROVED",
      metaJson: {
        ...(tx.metaJson as Record<string, unknown> | null),
        approvedAt: new Date().toISOString(),
        ...(actorUserId ? { approvedByUserId: actorUserId } : {}),
      },
    },
    include: { wallet: { include: { user: { select: { name: true, email: true } } } } },
  });

  return mapRow(updated);
}

export async function declineAdminWithdrawal(
  transactionId: string,
  actorUserId?: string,
): Promise<AdminWithdrawalDto> {
  const tx = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: true },
  });
  if (!tx || tx.entryType !== "WITHDRAWAL") {
    throw new AdminWithdrawalError("NOT_FOUND", "Withdrawal not found.");
  }
  if (tx.status !== "PENDING") {
    throw new AdminWithdrawalError("NOT_PENDING", "Withdrawal is not pending.");
  }

  const amount = tx.amount;

  const updated = await prisma.$transaction(async (inner) => {
    await inner.wallet.update({
      where: { id: tx.walletId },
      data: {
        lockedBalance: { decrement: amount },
        availableBalance: { increment: amount },
      },
    });

    return inner.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: "DECLINED",
        metaJson: {
          ...(tx.metaJson as Record<string, unknown> | null),
          declinedAt: new Date().toISOString(),
          ...(actorUserId ? { declinedByUserId: actorUserId } : {}),
        },
      },
      include: { wallet: { include: { user: { select: { name: true, email: true } } } } },
    });
  });

  return mapRow(updated);
}

export async function markAdminWithdrawalPaid(
  transactionId: string,
  actorUserId?: string,
  bankReference?: string,
): Promise<AdminWithdrawalDto> {
  const tx = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: true },
  });
  if (!tx || tx.entryType !== "WITHDRAWAL") {
    throw new AdminWithdrawalError("NOT_FOUND", "Withdrawal not found.");
  }
  if (tx.status !== "APPROVED" && tx.status !== "PENDING") {
    throw new AdminWithdrawalError("INVALID_ACTION", "Withdrawal must be approved or pending.");
  }
  if (tx.referenceType !== "affiliate_withdrawal") {
    throw new AdminWithdrawalError("INVALID_ACTION", "Not an affiliate withdrawal.");
  }

  const amount = tx.amount;
  const paidAt = new Date().toISOString();
  const trimmedReference = bankReference?.trim() ?? "";

  const updated = await prisma.$transaction(async (inner) => {
    if (tx.status === "PENDING") {
      await inner.walletTransaction.update({
        where: { id: transactionId },
        data: { status: "APPROVED" },
      });
    }

    await inner.wallet.update({
      where: { id: tx.walletId },
      data: { lockedBalance: { decrement: amount } },
    });

    return inner.walletTransaction.update({
      where: { id: transactionId },
      data: {
        metaJson: {
          ...(tx.metaJson as Record<string, unknown> | null),
          paidAt,
          ...(trimmedReference ? { bankReference: trimmedReference } : {}),
          ...(actorUserId ? { paidByUserId: actorUserId } : {}),
        },
      },
      include: { wallet: { include: { user: { select: { name: true, email: true } } } } },
    });
  });

  return mapRow(updated);
}
