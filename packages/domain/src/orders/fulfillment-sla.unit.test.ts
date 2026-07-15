import { describe, expect, it, afterEach } from "vitest";
import {
  getFulfillmentSlaConfig,
  isFulfillmentGroupStuck,
} from "./fulfillment-sla";

describe("fulfillment SLA", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("flags NEW group after default 48h", () => {
    const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
    expect(isFulfillmentGroupStuck("NEW", old)).toBe(true);
  });

  it("bypass disables stuck detection", () => {
    process.env.FULFILLMENT_SLA_BYPASS = "true";
    const old = new Date(Date.now() - 200 * 60 * 60 * 1000);
    expect(isFulfillmentGroupStuck("NEW", old, getFulfillmentSlaConfig())).toBe(false);
  });

  it("demo mode marks in-progress groups stuck immediately", () => {
    process.env.FULFILLMENT_SLA_DEMO_STUCK = "true";
    const recent = new Date();
    expect(isFulfillmentGroupStuck("PROCESSING", recent, getFulfillmentSlaConfig())).toBe(true);
  });
});
