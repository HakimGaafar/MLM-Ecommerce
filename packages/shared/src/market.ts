import { isMarketCodeFormat } from "./add-market-catalog";

/** Seed / launch markets only (static catalog + MARKET_IDS). */
export const MARKET_CODES = ["SA", "OM", "EG", "GLOBAL"] as const;

export type SeedMarketCode = (typeof MARKET_CODES)[number];

/**
 * Any marketplace code: seed (SA/OM/EG/GLOBAL) or wizard DB markets (AE, …).
 * Validate with {@link isMarketCodeFormat} at API boundaries.
 */
export type MarketCode = string;

/** @deprecated Use SeedMarketCode for seed-only maps; MarketCode is now any DB code. */
export type LegacySeedMarketCode = SeedMarketCode;

export type MarketDefinition = {
  code: SeedMarketCode;
  subdomain: string;
  defaultCurrency: string;
  geoCountryCodes: string[];
  nameEn: string;
  nameAr: string;
  sortOrder: number;
};

/** Static catalog — kept in sync with DB seed (Phase X1). */
export const MARKET_DEFINITIONS: readonly MarketDefinition[] = [
  {
    code: "SA",
    subdomain: "sa",
    defaultCurrency: "SAR",
    geoCountryCodes: ["SA"],
    nameEn: "Saudi Arabia",
    nameAr: "السعودية",
    sortOrder: 1,
  },
  {
    code: "OM",
    subdomain: "om",
    defaultCurrency: "OMR",
    geoCountryCodes: ["OM"],
    nameEn: "Oman",
    nameAr: "عُمان",
    sortOrder: 2,
  },
  {
    code: "EG",
    subdomain: "eg",
    defaultCurrency: "EGP",
    geoCountryCodes: ["EG"],
    nameEn: "Egypt",
    nameAr: "مصر",
    sortOrder: 3,
  },
  {
    code: "GLOBAL",
    subdomain: "global",
    defaultCurrency: "OMR",
    geoCountryCodes: [],
    nameEn: "International",
    nameAr: "عالمي",
    sortOrder: 4,
  },
] as const;

/** Checkout currencies accepted per seed market (Phase 1 legal foundations). */
export const MARKET_PAYMENT_CURRENCIES = {
  SA: ["SAR"],
  OM: ["OMR"],
  EG: ["EGP"],
  GLOBAL: ["OMR", "USD"],
} as const satisfies Record<SeedMarketCode, readonly string[]>;

/** Launch visibility defaults: Egypt built but closed/hidden. */
export const MARKET_LAUNCH_ACTIVE = {
  SA: true,
  OM: true,
  EG: false,
  GLOBAL: true,
} as const satisfies Record<SeedMarketCode, boolean>;

export const DEFAULT_MARKET_CODE: SeedMarketCode = "SA";

/** Stable DB primary keys — kept in sync with migrations/seed (Phase X1). */
export const MARKET_IDS = {
  SA: "market_sa",
  OM: "market_om",
  EG: "market_eg",
  GLOBAL: "market_global",
} as const satisfies Record<SeedMarketCode, string>;

export const DEFAULT_MARKET_ID = MARKET_IDS.SA;

export type MarketScope = {
  id: string;
  code: MarketCode;
  defaultCurrency: string;
};

/** Seed market id only. For wizard markets use resolveMarketIdByCode (domain). */
export function getMarketId(code: SeedMarketCode): string {
  return MARKET_IDS[code];
}

/** True if value is one of the four seed market codes. */
export function isSeedMarketCode(value: string): value is SeedMarketCode {
  return (MARKET_CODES as readonly string[]).includes(value.trim().toUpperCase());
}

/**
 * True if value is a valid market code format (seed or wizard).
 * Prefer this over {@link isSeedMarketCode} for request validation.
 */
export function isMarketCode(value: string): value is MarketCode {
  return isMarketCodeFormat(value);
}

export function getMarketDefinition(code: SeedMarketCode): MarketDefinition {
  const found = MARKET_DEFINITIONS.find((m) => m.code === code);
  if (!found) throw new Error(`Unknown market code: ${code}`);
  return found;
}

export function getMarketBySubdomain(subdomain: string): MarketDefinition | null {
  const normalized = subdomain.trim().toLowerCase();
  return MARKET_DEFINITIONS.find((m) => m.subdomain === normalized) ?? null;
}

/**
 * Sync seed-catalog geo resolve only.
 * Prefer domain `resolveActiveMarketCodeByGeoCountry` for DB markets (AE, …).
 */
export function resolveMarketFromGeoCountry(countryCode: string | null | undefined): SeedMarketCode {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc) return "GLOBAL";
  const direct = MARKET_DEFINITIONS.find((m) => m.geoCountryCodes.includes(cc));
  if (direct) return direct.code;
  return "GLOBAL";
}

/** Seed id → code only. Wizard market ids return null — resolve via Prisma. */
export function getMarketCodeById(marketId: string): SeedMarketCode | null {
  const entry = Object.entries(MARKET_IDS).find(([, id]) => id === marketId);
  return entry ? (entry[0] as SeedMarketCode) : null;
}

/** Country on the shipping address → seed marketplace (sync fallback). */
export function resolveDeliveryMarketForCountry(
  countryCode: string | null | undefined,
): SeedMarketCode {
  return resolveMarketFromGeoCountry(countryCode);
}

/**
 * Whether a shipping country belongs on this market.
 * Pass `marketGeoCountryCodes` from the DB market row for wizard markets.
 */
export function isShippingCountryAllowedForMarket(
  countryCode: string | null | undefined,
  activeMarketCode: MarketCode,
  marketGeoCountryCodes?: readonly string[],
): boolean {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || cc.length !== 2) return false;

  if (marketGeoCountryCodes && marketGeoCountryCodes.length > 0) {
    return marketGeoCountryCodes.some((g) => g.trim().toUpperCase() === cc);
  }

  // GLOBAL: countries that do not map to a seed home market.
  if (activeMarketCode === "GLOBAL") {
    return resolveDeliveryMarketForCountry(cc) === "GLOBAL";
  }

  if (isSeedMarketCode(activeMarketCode)) {
    return resolveDeliveryMarketForCountry(cc) === activeMarketCode;
  }

  // Wizard market without geo list: treat market code as the country claim when 2-letter.
  if (activeMarketCode.length === 2) {
    return cc === activeMarketCode.toUpperCase();
  }

  return false;
}

/** All market definitions (including launch-closed). Prefer {@link listLaunchActiveMarketDefinitions} for public surfaces. */
export function listActiveMarketDefinitions(): MarketDefinition[] {
  return [...MARKET_DEFINITIONS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Markets that are launch-visible by default (`MARKET_LAUNCH_ACTIVE`). DB `isActive` may still override at runtime. */
export function listLaunchActiveMarketDefinitions(): MarketDefinition[] {
  return listActiveMarketDefinitions().filter((def) => MARKET_LAUNCH_ACTIVE[def.code]);
}

/** Five Tap / compliance policy paths (live markets only when gated by caller). */
export const TAP_COMPLIANCE_POLICY_PATHS = [
  "/terms",
  "/privacy",
  "/returns-policy",
  "/shipping-policy",
  "/pricing-payment",
] as const;

export type TapCompliancePolicyPath = (typeof TAP_COMPLIANCE_POLICY_PATHS)[number];
