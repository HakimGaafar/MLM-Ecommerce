import { Queue, QueueEvents, Worker } from "bullmq";
import type { JobsOptions, Processor } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const settlementQueueName = "wallet-settlement";

export const SettlementJobName = {
  FINALIZE_ORDER_REWARDS: "finalize-order-rewards",
  RELEASE_PENDING_SETTLEMENTS: "release-pending-settlements",
  RELEASE_ALL_PENDING_FOR_USER: "release-all-pending-for-user",
} as const;

export type SettlementJobName = (typeof SettlementJobName)[keyof typeof SettlementJobName];

export type FinalizeOrderRewardsJobData = {
  orderId: string;
};

export type ReleasePendingSettlementsJobData = {
  transactionIds: string[];
  settledByUserId: string;
  method?: "manual" | "automatic";
};

export type ReleaseAllPendingForUserJobData = {
  userId: string;
  settledByUserId: string;
  entryTypes?: string[];
  method?: "manual" | "automatic";
};

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

export const settlementQueue = new Queue(settlementQueueName, {
  connection,
  defaultJobOptions,
});

let queueEvents: QueueEvents | null = null;

function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(settlementQueueName, { connection });
  }
  return queueEvents;
}

export function createSettlementWorker(processor: Processor) {
  const concurrency = Number.parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10);
  return new Worker(settlementQueueName, processor, {
    connection,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 5,
  });
}

export async function pingQueueRedis() {
  return connection.ping();
}

/** Shared Redis connection (BullMQ + app rate limits / session store). */
export function getQueueRedis() {
  return connection;
}

export async function enqueueFinalizeOrderRewards(orderId: string): Promise<void> {
  const jobId = `order-rewards:${orderId}`;
  try {
    await settlementQueue.add(
      SettlementJobName.FINALIZE_ORDER_REWARDS,
      { orderId } satisfies FinalizeOrderRewardsJobData,
      { jobId },
    );
  } catch (err) {
    if (err instanceof Error && /already exists/i.test(err.message)) {
      return;
    }
    throw err;
  }
}

export async function enqueueReleasePendingSettlements(
  data: ReleasePendingSettlementsJobData,
  options?: { waitMs?: number },
): Promise<unknown> {
  const job = await settlementQueue.add(
    SettlementJobName.RELEASE_PENDING_SETTLEMENTS,
    data,
  );

  if (options?.waitMs && options.waitMs > 0) {
    return job.waitUntilFinished(getQueueEvents(), options.waitMs);
  }

  return { jobId: job.id };
}

export async function enqueueReleaseAllPendingForUser(
  data: ReleaseAllPendingForUserJobData,
  options?: { waitMs?: number },
): Promise<unknown> {
  const job = await settlementQueue.add(
    SettlementJobName.RELEASE_ALL_PENDING_FOR_USER,
    data,
  );

  if (options?.waitMs && options.waitMs > 0) {
    return job.waitUntilFinished(getQueueEvents(), options.waitMs);
  }

  return { jobId: job.id };
}
