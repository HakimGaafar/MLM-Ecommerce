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
  packageKeyForLine,
  resolveFeeForFulfillmentLine,
  type CartLineForShipping,
} from "./shipping-checkout.service";

function packageKeys(lines: CartLineForShipping[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const line of lines) {
    const key = packageKeyForLine(line);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

describe("Phase IV / IV-b shipping checkout", () => {
  it("uses matrix fees per fulfillment type (15 / 0 / 20 SAR)", () => {
    expect(defaultShippingFeeForFulfillmentType("DIRECT")).toBe(SHIPPING_FEE_DIRECT_SAR);
    expect(defaultShippingFeeForFulfillmentType("FORSEIZ_STOCK")).toBe(SHIPPING_FEE_WAREHOUSE_A_SAR);
    expect(defaultShippingFeeForFulfillmentType("ON_ORDER")).toBe(SHIPPING_FEE_WAREHOUSE_B_SAR);
  });

  it("Same FOURCES warehouse → one package (even across vendors)", () => {
    const lines: CartLineForShipping[] = [
      {
        vendorId: "v1",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
      {
        vendorId: "v1",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
      {
        vendorId: "v2",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
    ];
    expect(groupCartLinesForShipping(lines)).toHaveLength(1);
    expect(packageKeys(lines)).toEqual(["fources:warehouse_sa"]);
  });

  it("Different merchants → separate packages", () => {
    const lines: CartLineForShipping[] = [
      { vendorId: "vendorA", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
      { vendorId: "vendorB", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
    ];
    expect(groupCartLinesForShipping(lines)).toHaveLength(2);
    expect(packageKeys(lines)).toEqual(["merchant:vendorA", "merchant:vendorB"]);
  });

  it("Same merchant, two MERCHANT products → one package", () => {
    const lines: CartLineForShipping[] = [
      { vendorId: "v1", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
      { vendorId: "v1", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
    ];
    expect(groupCartLinesForShipping(lines)).toHaveLength(1);
    expect(packageKeys(lines)).toEqual(["merchant:v1"]);
  });

  it("FOURCES + MERCHANT in one cart → two packages", () => {
    const lines: CartLineForShipping[] = [
      {
        vendorId: "v1",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
      { vendorId: "v1", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
    ];
    expect(groupCartLinesForShipping(lines)).toHaveLength(2);
    expect(packageKeys(lines)).toEqual(["fources:warehouse_sa", "merchant:v1"]);
  });

  it("groups mixed cart into FOURCES warehouse + per-merchant packages", () => {
    const lines: CartLineForShipping[] = [
      { vendorId: "v1", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
      { vendorId: "v1", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
      {
        vendorId: "v1",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
      {
        vendorId: "v2",
        fulfillmentType: "FORSEIZ_STOCK",
        stockLocation: "FOURCES_WAREHOUSE",
        warehouseId: "warehouse_sa",
      },
      { vendorId: "v2", fulfillmentType: "DIRECT", stockLocation: "MERCHANT" },
    ];
    expect(groupCartLinesForShipping(lines)).toHaveLength(3);
    expect(packageKeys(lines)).toEqual([
      "merchant:v1",
      "fources:warehouse_sa",
      "merchant:v2",
    ]);
  });

  it("charges one fee per group — same vendor with two fulfillment types sums both matrix fees", () => {
    const vendor = {
      id: "v1",
      storeName: "Shop",
      countryCode: "SA",
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
      countryCode: "SA",
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
