import {
  MARKET_IDS,
  MARKET_LAUNCH_ACTIVE,
  resolveMarketFromGeoCountry,
  type MarketCode,
} from "./market";

export const SHIPPING_PACKAGE_TYPES = [
  "VANDSOQ_DOMESTIC",
  "VANDSOQ_INTERNATIONAL",
  "MERCHANT_DOMESTIC",
  "MERCHANT_INTERNATIONAL",
] as const;

export type ShippingPackageTypeCode = (typeof SHIPPING_PACKAGE_TYPES)[number];

export const PRODUCT_STOCK_LOCATIONS = ["MERCHANT", "VANDSOQ_WAREHOUSE"] as const;

export type ProductStockLocationCode = (typeof PRODUCT_STOCK_LOCATIONS)[number];

/** Stable VANDSOQ warehouse IDs — kept in sync with Phase 0 migration seed. */
export const VANDSOQ_WAREHOUSE_IDS = {
  SA: "warehouse_sa",
  OM: "warehouse_om",
  EG: "warehouse_eg",
} as const satisfies Record<"SA" | "OM" | "EG", string>;

export const VANDSOQ_WAREHOUSE_MARKET_CODES = ["SA", "OM", "EG"] as const;

export type VandsoqWarehouseMarketCode = (typeof VANDSOQ_WAREHOUSE_MARKET_CODES)[number];

export function isVandsoqWarehouseMarketCode(
  code: string,
): code is VandsoqWarehouseMarketCode {
  return (VANDSOQ_WAREHOUSE_MARKET_CODES as readonly string[]).includes(code);
}

/**
 * Vendor home classification from country of residence/operation.
 * Closed launch markets (e.g. EG) park on GLOBAL until opened in DB —
 * pass `activeByCode` from runtime for admin-opened markets after deploy defaults.
 */
export function primaryMarketFromCountry(
  countryCode: string | null | undefined,
  activeByCode?: Partial<Record<MarketCode, boolean>>,
): MarketCode {
  const natural = resolveMarketFromGeoCountry(countryCode);
  if (natural === "GLOBAL") return "GLOBAL";
  const active = activeByCode?.[natural] ?? MARKET_LAUNCH_ACTIVE[natural];
  return active ? natural : "GLOBAL";
}

export function primaryMarketIdFromCountry(
  countryCode: string | null | undefined,
  activeByCode?: Partial<Record<MarketCode, boolean>>,
): string {
  return MARKET_IDS[primaryMarketFromCountry(countryCode, activeByCode)];
}

function normalizeCountry(code: string | null | undefined): string | null {
  const cc = code?.trim().toUpperCase();
  return cc ? cc : null;
}

/**
 * Infer shipping package type from stock location + geography.
 * Used by later checkout phases; pure helper for Phase 0+.
 */
export function inferShippingPackageType(input: {
  stockLocation: ProductStockLocationCode;
  warehouseCountry?: string | null;
  customerCountry: string | null | undefined;
  merchantCountry: string | null | undefined;
}): ShippingPackageTypeCode {
  const customer = normalizeCountry(input.customerCountry);
  const merchant = normalizeCountry(input.merchantCountry);
  const warehouse = normalizeCountry(input.warehouseCountry);

  if (input.stockLocation === "VANDSOQ_WAREHOUSE") {
    if (customer && warehouse && customer === warehouse) {
      return "VANDSOQ_DOMESTIC";
    }
    return "VANDSOQ_INTERNATIONAL";
  }

  if (customer && merchant && customer === merchant) {
    return "MERCHANT_DOMESTIC";
  }
  return "MERCHANT_INTERNATIONAL";
}
