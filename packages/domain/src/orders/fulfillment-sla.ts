import type { OrderStatus } from "@mlm/db";

export type FulfillmentSlaConfig = {
  newMaxHours: number;
  processingMaxHours: number;
  bypass: boolean;
  demoStuck: boolean;
};

function parsePositiveHours(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getFulfillmentSlaConfig(): FulfillmentSlaConfig {
  const bypass = process.env.FULFILLMENT_SLA_BYPASS === "true";
  const demoStuck = process.env.FULFILLMENT_SLA_DEMO_STUCK === "true";
  return {
    newMaxHours: parsePositiveHours(process.env.FULFILLMENT_SLA_NEW_HOURS, 48),
    processingMaxHours: parsePositiveHours(process.env.FULFILLMENT_SLA_PROCESSING_HOURS, 72),
    bypass,
    demoStuck,
  };
}

export function hoursSince(isoOrDate: Date | string): number {
  const then = isoOrDate instanceof Date ? isoOrDate.getTime() : new Date(isoOrDate).getTime();
  return Math.max(0, (Date.now() - then) / (1000 * 60 * 60));
}

export function isFulfillmentGroupStuck(
  status: OrderStatus,
  fulfillmentUpdatedAt: Date,
  config: FulfillmentSlaConfig = getFulfillmentSlaConfig(),
): boolean {
  if (config.bypass) return false;
  if (status === "SHIPPED" || status === "COMPLETED" || status === "CANCELLED") return false;
  if (config.demoStuck) return status === "NEW" || status === "PROCESSING";
  const waitingHours = hoursSince(fulfillmentUpdatedAt);
  if (status === "NEW") return waitingHours >= config.newMaxHours;
  if (status === "PROCESSING") return waitingHours >= config.processingMaxHours;
  return false;
}

export function slaThresholdHoursForStatus(
  status: OrderStatus,
  config: FulfillmentSlaConfig = getFulfillmentSlaConfig(),
): number | null {
  if (status === "NEW") return config.newMaxHours;
  if (status === "PROCESSING") return config.processingMaxHours;
  return null;
}
