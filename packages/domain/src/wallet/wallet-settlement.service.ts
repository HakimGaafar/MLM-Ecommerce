import type { WalletEntryType } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";

export const ADMIN_SETTLEABLE_ENTRY_TYPES: WalletEntryType[] = [
  "AFFILIATE_COMMISSION",
  "VENDOR_EARNING",
];

export type SettlementMethod = "manual" | "automatic";

export class WalletSettlementError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "NOT_PENDING"
      | "NOT_SETTLEABLE"
      | "INVALID_DIRECTION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WalletSettlementError";
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isSettleableType(entryType: WalletEntryType): boolean {
  return ADMIN_SETTLEABLE_ENTRY_TYPES.includes(entryType);
}

/**
 * Moves one PENDING credit from pending balance to available (APPROVED).
 * Idempotent when already APPROVED.
 */
export async function settlePendingWalletTransaction(params: {
  transactionId: string;
  settledByUserId: string;
  method: SettlementMethod;
}): Promise<{ transactionId: string; alreadySettled: boolean }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.walletTransaction.findUnique({
      where: { id: params.transactionId },
      include: { wallet: { select: { id: true, currency: true } } },
    });

    if (!row) {
      throw new WalletSettlementError("NOT_FOUND", "Transaction not found.");
    }

    if (row.status === "APPROVED") {
      return { transactionId: row.id, alreadySettled: true };
    }

    if (row.status === "REVERSED") {
      throw new WalletSettlementError(
        "NOT_PENDING",
        "This earning was reversed by a return and cannot be released.",
      );
    }

    if (row.status !== "PENDING") {
      throw new WalletSettlementError("NOT_PENDING", "Only pending transactions can be released.");
    }

    if (row.direction !== "CREDIT") {
      throw new WalletSettlementError("INVALID_DIRECTION", "Only credit entries can be released.");
    }

    if (!isSettleableType(row.entryType)) {
      throw new WalletSettlementError(
        "NOT_SETTLEABLE",
        "This transaction type cannot be released to available balance.",
      );
    }

    const amount = new Prisma.Decimal(row.amount.toString());
    const priorMeta =
      row.metaJson && typeof row.metaJson === "object" && !Array.isArray(row.metaJson)
        ? (row.metaJson as Record<string, unknown>)
        : {};

    await tx.walletTransaction.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        metaJson: {
          ...priorMeta,
          settledAt: new Date().toISOString(),
          settledByUserId: params.settledByUserId,
          settlementMethod: params.method,
          kind: priorMeta.kind ?? "wallet_settlement",
        },
      },
    });

    await tx.wallet.update({
      where: { id: row.walletId },
      data: {
        pendingBalance: { decrement: amount },
        availableBalance: { increment: amount },
      },
    });

    return { transactionId: row.id, alreadySettled: false };
  });
}

export async function settlePendingWalletTransactions(params: {
  transactionIds: string[];
  settledByUserId: string;
  method?: SettlementMethod;
}): Promise<{
  released: string[];
  alreadySettled: string[];
  failed: { id: string; error: string }[];
}> {
  const method = params.method ?? "manual";
  const released: string[] = [];
  const alreadySettled: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of params.transactionIds) {
    try {
      const result = await settlePendingWalletTransaction({
        transactionId: id,
        settledByUserId: params.settledByUserId,
        method,
      });
      if (result.alreadySettled) alreadySettled.push(id);
      else released.push(id);
    } catch (e) {
      failed.push({
        id,
        error: e instanceof WalletSettlementError ? e.message : e instanceof Error ? e.message : "Release failed",
      });
    }
  }

  return { released, alreadySettled, failed };
}

export async function settleAllPendingForUser(params: {
  userId: string;
  settledByUserId: string;
  entryTypes?: WalletEntryType[];
  method?: SettlementMethod;
}): Promise<{
  released: string[];
  alreadySettled: string[];
  failed: { id: string; error: string }[];
}> {
  const types = params.entryTypes?.length
    ? params.entryTypes.filter(isSettleableType)
    : ADMIN_SETTLEABLE_ENTRY_TYPES;

  const rows = await prisma.walletTransaction.findMany({
    where: {
      userId: params.userId,
      status: "PENDING",
      direction: "CREDIT",
      entryType: { in: types },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return settlePendingWalletTransactions({
    transactionIds: rows.map((r) => r.id),
    settledByUserId: params.settledByUserId,
    method: params.method,
  });
}
