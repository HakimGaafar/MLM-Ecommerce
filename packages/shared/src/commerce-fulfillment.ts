import { MARKET_IDS, resolveMarketFromGeoCountry, type MarketCode } from "./market";

export const SHIPPING_PACKAGE_TYPES = [
  "FOURCES_DOMESTIC",
  "FOURCES_INTERNATIONAL",
  "MERCHANT_DOMESTIC",
  "MERCHANT_INTERNATIONAL",
] as const;

export type ShippingPackageTypeCode = (typeof SHIPPING_PACKAGE_TYPES)[number];

export const PRODUCT_STOCK_LOCATIONS = ["MERCHANT", "FOURCES_WAREHOUSE"] as const;

export type ProductStockLocationCode = (typeof PRODUCT_STOCK_LOCATIONS)[number];

/** Stable FOURCES warehouse IDs — kept in sync with Phase 0 migration seed. */
export const FOURCES_WAREHOUSE_IDS = {
  SA: "warehouse_sa",
  OM: "warehouse_om",
  EG: "warehouse_eg",
} as const satisfies Record<"SA" | "OM" | "EG", string>;

export const FOURCES_WAREHOUSE_MARKET_CODES = ["SA", "OM", "EG"] as const;

export type FourcesWarehouseMarketCode = (typeof FOURCES_WAREHOUSE_MARKET_CODES)[number];

export function isFourcesWarehouseMarketCode(
  code: string,
): code is FourcesWarehouseMarketCode {
  return (FOURCES_WAREHOUSE_MARKET_CODES as readonly string[]).includes(code);
}

/** Vendor home classification from country of residence/operation. */
export function primaryMarketFromCountry(
  countryCode: string | null | undefined,
): MarketCode {
  return resolveMarketFromGeoCountry(countryCode);
}

export function primaryMarketIdFromCountry(
  countryCode: string | null | undefined,
): string {
  return MARKET_IDS[primaryMarketFromCountry(countryCode)];
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

  if (input.stockLocation === "FOURCES_WAREHOUSE") {
    if (customer && warehouse && customer === warehouse) {
      return "FOURCES_DOMESTIC";
    }
    return "FOURCES_INTERNATIONAL";
  }

  if (customer && merchant && customer === merchant) {
    return "MERCHANT_DOMESTIC";
  }
  return "MERCHANT_INTERNATIONAL";
}
