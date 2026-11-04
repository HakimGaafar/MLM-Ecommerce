import type { PlatformConfigSnapshot } from "../platform-config/platform-config.service";

export type CommissionSplitKind = "HOME" | "CROSS";

export type CommissionSplit = {
  kind: CommissionSplitKind;
  platformRate: number;
  vendorRate: number;
};

/**
 * Home = vendor primary market equals order market.
 * Cross = otherwise, or International (GLOBAL) market code (always 10% platform).
 */
export function resolveCommissionSplit(params: {
  vendorPrimaryMarketId: string;
  orderMarketId: string;
  orderMarketCode?: string | null;
  config: Pick<
    PlatformConfigSnapshot,
    "platformRate" | "vendorRate" | "platformRateCross" | "vendorRateCross"
  >;
}): CommissionSplit {
  const isInternational = (params.orderMarketCode ?? "").toUpperCase() === "GLOBAL";
  const isHome =
    !isInternational && params.vendorPrimaryMarketId === params.orderMarketId;

  if (isHome) {
    return {
      kind: "HOME",
      platformRate: params.config.platformRate,
      vendorRate: params.config.vendorRate,
    };
  }

  return {
    kind: "CROSS",
    platformRate: params.config.platformRateCross,
    vendorRate: params.config.vendorRateCross,
  };
}

export function normalizeCityKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Same-city COD: ship-to city matches vendor city (Phase 4 assumption). */
export function isSameCityDelivery(params: {
  vendorCity: string | null | undefined;
  shipToCity: string | null | undefined;
}): boolean {
  const a = normalizeCityKey(params.vendorCity);
  const b = normalizeCityKey(params.shipToCity);
  return Boolean(a && b && a === b);
}
