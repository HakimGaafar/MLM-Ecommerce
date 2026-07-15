import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";
import { getMinWithdrawalAmount } from "../platform-config/platform-config.service";
import { assertKycApprovedForWithdraw, KycWithdrawGateError } from "../kyc/kyc-withdraw-gate";
import { ensureWallet } from "./wallet.service";

export class AffiliateWithdrawalError extends Error {
  constructor(
    public readonly code:
      | "WALLET_NOT_FOUND"
      | "INSUFFICIENT_BALANCE"
      | "INVALID_AMOUNT"
      | "WITHDRAWAL_NOT_FOUND"
      | "WITHDRAWAL_NOT_PENDING"
      | "KYC_NOT_APPROVED"
      | "KYC_ID_EXPIRED"
      | "BELOW_MINIMUM",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AffiliateWithdrawalError";
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type AffiliateWithdrawalRequestDto = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
};

/** Customer requests payout from available wallet balance (funds move to locked until paid/declined). */
export async function requestAffiliateWithdrawal(params: {
  userId: string;
  amount: number;
  marketId?: string;
  kycSubject?: "CUSTOMER" | "AFFILIATE";
}): Promise<AffiliateWithdrawalRequestDto> {
  const amount = roundMoney(params.amount);
  if (amount <= 0) {
    throw new AffiliateWithdrawalError("INVALID_AMOUNT", "Amount must be greater than zero.");
  }

  const marketId = params.marketId ?? DEFAULT_MARKET_ID;
  const wallet = await ensureWallet(params.userId, marketId);
  const minWithdrawal = await getMinWithdrawalAmount(marketId);
  if (amount < minWithdrawal) {
    throw new AffiliateWithdrawalError(
      "BELOW_MINIMUM",
      `Minimum withdrawal is ${minWithdrawal} ${wallet.currency}.`,
    );
  }

  const kycSubject = params.kycSubject ?? "CUSTOMER";
  try {
    await assertKycApprovedForWithdraw({ userId: params.userId, subjectType: kycSubject });
  } catch (error) {
    if (error instanceof KycWithdrawGateError) {
      if (error.code === "KYC_ID_EXPIRED") {
        throw new AffiliateWithdrawalError("KYC_ID_EXPIRED", error.message);
      }
      throw new AffiliateWithdrawalError("KYC_NOT_APPROVED", error.message);
    }
    throw error;
  }

  const available = Number(wallet.availableBalance);
  if (available < amount) {
    throw new AffiliateWithdrawalError("INSUFFICIENT_BALANCE", "Insufficient available balance.");
  }

  const requestId = randomUUID();
  const idempotencyKey = `affiliate-withdrawal:request:${requestId}`;

  const row = await prisma.$transaction(async (tx) => {
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (Number(fresh.availableBalance) < amount) {
      throw new AffiliateWithdrawalError("INSUFFICIENT_BALANCE", "Insufficient available balance.");
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: amount },
        lockedBalance: { increment: amount },
      },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: params.userId,
        entryType: "WITHDRAWAL",
        direction: "DEBIT",
        amount: new Prisma.Decimal(amount),
        status: "PENDING",
        referenceType: "affiliate_withdrawal",
        referenceId: requestId,
        idempotencyKey,
        metaJson: {
          kind: "affiliate_withdrawal_request",
          currency: wallet.currency,
        },
      },
    });
  });

  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: wallet.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
