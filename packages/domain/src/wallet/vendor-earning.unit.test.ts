import { describe, expect, it } from "vitest";
import {
  calculateVendorEarningAmount,
  getVendorEligibleAmount,
  sumVendorLineTotals,
} from "./vendor-earning.service";

describe("vendor earning calculations", () => {
  it("sums only the vendor lines", () => {
    const total = sumVendorLineTotals(
      [
        { vendorId: "v1", lineTotal: "40" },
        { vendorId: "v2", lineTotal: "16" },
        { vendorId: "v1", lineTotal: "16" },
      ],
      "v1",
    );
    expect(total).toBe(56);
  });

  it("applies proportional order discount to vendor lines", () => {
    const eligible = getVendorEligibleAmount({
      vendorLineTotal: 56,
      orderSubtotal: 100,
      orderDiscountTotal: 10,
    });
    expect(eligible).toBe(50.4);
  });

  it("uses full vendor lines when order has no discount", () => {
    const eligible = getVendorEligibleAmount({
      vendorLineTotal: 56,
      orderSubtotal: 56,
      orderDiscountTotal: 0,
    });
    expect(eligible).toBe(56);
  });

  it("credits 70% vendor rate (week1 rules)", () => {
    expect(calculateVendorEarningAmount(56, 0.7)).toBe(39.2);
  });
});
