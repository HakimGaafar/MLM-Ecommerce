import {
  createSettlementWorker,
  SettlementJobName,
  type FinalizeOrderRewardsJobData,
  type ReleaseAllPendingForUserJobData,
  type ReleasePendingSettlementsJobData,
} from "@mlm/queue";
import {
  finalizeOrderRewards,
  settleAllPendingForUser,
  settlePendingWalletTransactions,
} from "@mlm/domain";
import type { WalletEntryType } from "@mlm/db";

function log(level: "info" | "error", message: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({ level, message, ...extra, ts: new Date().toISOString() });
  if (level === "error") console.error(line);
  else console.log(line);
}

const worker = createSettlementWorker(async (job) => {
  switch (job.name) {
    case SettlementJobName.FINALIZE_ORDER_REWARDS: {
      const { orderId } = job.data as FinalizeOrderRewardsJobData;
      await finalizeOrderRewards(orderId);
      return { ok: true, orderId };
    }

    case SettlementJobName.RELEASE_PENDING_SETTLEMENTS: {
      const data = job.data as ReleasePendingSettlementsJobData;
      return settlePendingWalletTransactions({
        transactionIds: data.transactionIds,
        settledByUserId: data.settledByUserId,
        method: data.method ?? "manual",
      });
    }

    case SettlementJobName.RELEASE_ALL_PENDING_FOR_USER: {
      const data = job.data as ReleaseAllPendingForUserJobData;
      return settleAllPendingForUser({
        userId: data.userId,
        settledByUserId: data.settledByUserId,
        entryTypes: data.entryTypes as WalletEntryType[] | undefined,
        method: data.method ?? "manual",
      });
    }

    default:
      throw new Error(`Unknown settlement job: ${job.name}`);
  }
});

worker.on("completed", (job) => {
  log("info", "settlement job completed", { jobName: job.name, jobId: job.id });
});

worker.on("failed", (job, err) => {
  log("error", "settlement job failed", {
    jobName: job?.name,
    jobId: job?.id,
    error: err instanceof Error ? err.message : String(err),
  });
});

async function shutdown(signal: string) {
  log("info", "worker shutting down", { signal });
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

log("info", "wallet-settlement worker running");
