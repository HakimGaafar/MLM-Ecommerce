import { describe, expect, it } from "vitest";
import { Prisma } from "@mlm/db";
import {
  defaultShippingFeeForFulfillmentType,
  SHIPPING_FEE_DIRECT_SAR,
  SHIPPING_FEE_WAREHOUSE_A_SAR,
  SHIPPING_FEE_WAREHOUSE_B_SAR,
} from "@mlm/shared";
import {
  groupCartLinesForShipping,
  resolveFeeForFulfillmentLine,
} from "./shipping-checkout.service";

describe("Phase IV / IV-b shipping checkout", () => {
  it("uses matrix fees per fulfillment type (15 / 0 / 20 SAR)", () => {
    expect(defaultShippingFeeForFulfillmentType("DIRECT")).toBe(SHIPPING_FEE_DIRECT_SAR);
    expect(defaultShippingFeeForFulfillmentType("FORSEIZ_STOCK")).toBe(SHIPPING_FEE_WAREHOUSE_A_SAR);
    expect(defaultShippingFeeForFulfillmentType("ON_ORDER")).toBe(SHIPPING_FEE_WAREHOUSE_B_SAR);
  });

  it("groups cart lines by (vendorId, fulfillmentType) — Rule B", () => {
    const grouped = groupCartLinesForShipping([
      { vendorId: "v1", fulfillmentType: "DIRECT" },
      { vendorId: "v1", fulfillmentType: "DIRECT" },
      { vendorId: "v1", fulfillmentType: "FORSEIZ_STOCK" },
      { vendorId: "v2", fulfillmentType: "DIRECT" },
    ]);
    expect(grouped).toHaveLength(3);
    expect(grouped).toEqual([
      { vendorId: "v1", fulfillmentType: "DIRECT" },
      { vendorId: "v1", fulfillmentType: "FORSEIZ_STOCK" },
      { vendorId: "v2", fulfillmentType: "DIRECT" },
    ]);
  });

  it("charges one fee per group — same vendor with two fulfillment types sums both matrix fees", () => {
    const vendor = {
      id: "v1",
      storeName: "Shop",
      shippingMode: "DIRECT" as const,
      indirectFulfillment: null,
      shippingFee: null,
      shippingProfileStatus: "APPROVED" as const,
      defaultShippingFee: null,
    };
    const directFee = resolveFeeForFulfillmentLine(vendor, "DIRECT");
    const stockFee = resolveFeeForFulfillmentLine(vendor, "FORSEIZ_STOCK");
    expect(Number(directFee)).toBe(15);
    expect(Number(stockFee)).toBe(0);
    expect(Number(directFee.add(stockFee))).toBe(15);
  });

  it("applies vendor custom fee only when product fulfillment matches vendor primary profile", () => {
    const vendor = {
      id: "v1",
      storeName: "Shop",
      shippingMode: "DIRECT" as const,
      indirectFulfillment: null,
      shippingFee: new Prisma.Decimal("12.00"),
      shippingProfileStatus: "APPROVED" as const,
      defaultShippingFee: null,
    };
    expect(Number(resolveFeeForFulfillmentLine(vendor, "DIRECT"))).toBe(12);
    expect(Number(resolveFeeForFulfillmentLine(vendor, "FORSEIZ_STOCK"))).toBe(0);
    expect(Number(resolveFeeForFulfillmentLine(vendor, "ON_ORDER"))).toBe(20);
  });
});
