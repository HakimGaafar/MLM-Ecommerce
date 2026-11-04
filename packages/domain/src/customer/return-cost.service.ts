/**
 * Return shipping cost — one policy for city / country / cross-border.
 * Fee = go + return. Bearer from return reason (admin may override after hub inspect).
 * @see docs/RETURNS_AND_PAYOUT_INVOICE.md
 */

import type { OrderReturnReason } from "@mlm/db";

export type ReturnCostZone = "SAME_CITY" | "SAME_COUNTRY" | "CROSS_BORDER" | "UNKNOWN";
export type ReturnCostBearer = "CUSTOMER" | "VENDOR" | "PLATFORM";

export type ReturnCostEstimate = {
  zone: ReturnCostZone;
  fee: string;
  currency: string;
  bearer: ReturnCostBearer;
  /** True when fee is provisional (cross-border / unknown) until hub inspection. */
  crossBorderDeferred: boolean;
  note: string;
};

/** Round-trip trial matrix (market currency). */
const RETURN_FEE_MATRIX: Record<
  "SAME_CITY" | "SAME_COUNTRY" | "CROSS_BORDER",
  number
> = {
  SAME_CITY: 30,
  SAME_COUNTRY: 50,
  CROSS_BORDER: 80,
};

const VENDOR_FAULT_REASONS: ReadonlySet<OrderReturnReason> = new Set([
  "WRONG_ITEM",
  "INCOMPLETE",
  "DEFECTIVE",
  "COUNTERFEIT",
  "DAMAGED_IN_TRANSIT",
]);

function normCity(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normCountry(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function resolveReturnCostZone(params: {
  orderCountryCode: string | null | undefined;
  orderCity: string | null | undefined;
  vendorCountryCode: string | null | undefined;
  vendorCity: string | null | undefined;
}): ReturnCostZone {
  const oc = normCountry(params.orderCountryCode);
  const vc = normCountry(params.vendorCountryCode);
  if (!oc || !vc) return "UNKNOWN";
  if (oc !== vc) return "CROSS_BORDER";
  const oCity = normCity(params.orderCity);
  const vCity = normCity(params.vendorCity);
  if (oCity && vCity && oCity === vCity) return "SAME_CITY";
  return "SAME_COUNTRY";
}

/** Who pays round-trip return shipping from the customer's selected reason. */
export function bearerFromReturnReason(reason: OrderReturnReason): ReturnCostBearer {
  return VENDOR_FAULT_REASONS.has(reason) ? "VENDOR" : "CUSTOMER";
}

export function estimateReturnCost(params: {
  zone: ReturnCostZone;
  currency: string;
  reason?: OrderReturnReason | null;
}): ReturnCostEstimate {
  const bearer = params.reason
    ? bearerFromReturnReason(params.reason)
    : ("CUSTOMER" as ReturnCostBearer);

  if (params.zone === "UNKNOWN") {
    return {
      zone: params.zone,
      fee: "0.00",
      currency: params.currency,
      bearer,
      crossBorderDeferred: true,
      note: "Return shipping cost will be confirmed after address / hub review.",
    };
  }

  const fee = RETURN_FEE_MATRIX[params.zone];
  const provisional = params.zone === "CROSS_BORDER";

  const zoneNote =
    params.zone === "SAME_CITY"
      ? "Same-city round-trip return shipping."
      : params.zone === "SAME_COUNTRY"
        ? "Same-country round-trip return shipping."
        : "Cross-border estimate (go+return). Final fee confirmed after buyer-market hub inspection.";

  const bearerNote =
    bearer === "VENDOR"
      ? " Shipping cost assigned to vendor (reported seller fault)."
      : " Shipping cost assigned to customer (change of mind / no defect).";

  return {
    zone: params.zone,
    fee: fee.toFixed(2),
    currency: params.currency,
    bearer,
    crossBorderDeferred: provisional,
    note: zoneNote + bearerNote,
  };
}

/** @deprecated Use estimateReturnCost */
export function estimateLocalReturnCost(params: {
  zone: ReturnCostZone;
  currency: string;
  reason?: OrderReturnReason | null;
}): ReturnCostEstimate {
  return estimateReturnCost(params);
}
