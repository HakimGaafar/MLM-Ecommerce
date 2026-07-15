import {
  enqueueFinalizeOrderRewards,
  enqueueReleaseAllPendingForUser,
  enqueueReleasePendingSettlements,
} from "@mlm/queue";
import type { WalletEntryType } from "@mlm/db";
import type { SettlementMethod } from "./wallet-settlement.service";
import {
  settleAllPendingForUser,
  settlePendingWalletTransactions,
} from "./wallet-settlement.service";
import { finalizeOrderRewards } from "./wallet.service";

const SETTLEMENT_WAIT_MS = 60_000;

/**
 * Master switch for Phase XII async pipeline (BullMQ worker).
 * false (default) = pre-XII behavior: wallet work runs inline; no worker service required.
 * true = enqueue to Redis; requires Redis + `npm run dev:worker` (or Railway worker service).
 */
function isPhaseXiiEnabled(): boolean {
  return process.env.PHASE_XII_ENABLED === "true";
}

function rewardsDispatchMode(): "queue" | "sync" {
  if (!isPhaseXiiEnabled()) return "sync";
  return process.env.WALLET_REWARDS_DISPATCH === "sync" ? "sync" : "queue";
}

function settlementDispatchMode(): "queue" | "sync" {
  if (!isPhaseXiiEnabled()) return "sync";
  return process.env.WALLET_SETTLEMENT_DISPATCH === "sync" ? "sync" : "queue";
}

/**
 * Schedules buyer cashback + affiliate + vendor accrual off the HTTP path (XII1).
 * Idempotent ledger keys remain in finalizeOrderRewards — safe worker retries.
 */
export async function scheduleFinalizeOrderRewards(orderId: string): Promise<void> {
  if (rewardsDispatchMode() === "sync") {
    await finalizeOrderRewards(orderId);
    return;
  }

  await enqueueFinalizeOrderRewards(orderId);
}

export async function scheduleReleasePendingSettlements(params: {
  transactionIds: string[];
  settledByUserId: string;
  method?: SettlementMethod;
}): Promise<Awaited<ReturnType<typeof settlePendingWalletTransactions>>> {
  if (settlementDispatchMode() === "sync") {
    return settlePendingWalletTransactions(params);
  }

  return enqueueReleasePendingSettlements(params, { waitMs: SETTLEMENT_WAIT_MS }) as Promise<
    Awaited<ReturnType<typeof settlePendingWalletTransactions>>
  >;
}

export async function scheduleReleaseAllPendingForUser(params: {
  userId: string;
  settledByUserId: string;
  entryTypes?: WalletEntryType[];
  method?: SettlementMethod;
}): Promise<Awaited<ReturnType<typeof settleAllPendingForUser>>> {
  if (settlementDispatchMode() === "sync") {
    return settleAllPendingForUser(params);
  }

  return enqueueReleaseAllPendingForUser(params, { waitMs: SETTLEMENT_WAIT_MS }) as Promise<
    Awaited<ReturnType<typeof settleAllPendingForUser>>
  >;
}
