import { describe, expect, it } from "vitest";
import { week1BusinessRules } from "../business-rules";
import {
  calculateAffiliateCommissionAmounts,
  getAffiliateEligibleOrderAmount,
} from "./affiliate-commission.service";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

describe("affiliate commission calculations", () => {
  it("eligible amount is subtotal minus discount, floored at zero", () => {
    expect(getAffiliateEligibleOrderAmount({ subtotal: 100, discountTotal: 10 })).toBe(90);
    expect(getAffiliateEligibleOrderAmount({ subtotal: 50, discountTotal: 60 })).toBe(0);
  });

  it("level amounts use pool rate and per-level rates", () => {
    const config = {
      affiliatePoolRate: week1BusinessRules.defaultCommissionRates.affiliatePoolRate,
      affiliateLevelRates: week1BusinessRules.defaultCommissionRates.levelRates as [
        number,
        number,
        number,
        number,
      ],
    };
    const amounts = calculateAffiliateCommissionAmounts(100, config);
    expect(amounts).toHaveLength(4);
    // pool = 10; L1 = 5% of pool = 0.5
    expect(amounts[0]).toBe(0.5);
    expect(amounts[1]).toBe(0.2);
    expect(amounts[2]).toBe(0.2);
    expect(amounts[3]).toBe(0.1);
  });

  it("cashback uses same eligible basis as affiliate pool (not order total with shipping/VAT)", () => {
    const eligible = getAffiliateEligibleOrderAmount({ subtotal: 56, discountTotal: 0 });
    const cashback = roundMoney(eligible * week1BusinessRules.defaultCommissionRates.cashbackRate);
    expect(eligible).toBe(56);
    expect(cashback).toBe(2.8);
    // Checkout total ~81.65 would wrongly yield 4.08 if totalAmount were used
    expect(roundMoney(81.65 * 0.05)).toBe(4.08);
  });
});
