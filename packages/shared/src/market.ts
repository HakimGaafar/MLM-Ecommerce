export const MARKET_CODES = ["SA", "OM", "EG", "GLOBAL"] as const;

export type MarketCode = (typeof MARKET_CODES)[number];

export type MarketDefinition = {
  code: MarketCode;
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

/** Checkout currencies accepted per market (Phase 1 legal foundations). */
export const MARKET_PAYMENT_CURRENCIES = {
  SA: ["SAR"],
  OM: ["OMR"],
  EG: ["EGP"],
  GLOBAL: ["OMR", "USD"],
} as const satisfies Record<MarketCode, readonly string[]>;

/** Launch visibility defaults: Egypt built but closed/hidden. */
export const MARKET_LAUNCH_ACTIVE = {
  SA: true,
  OM: true,
  EG: false,
  GLOBAL: true,
} as const satisfies Record<MarketCode, boolean>;

export const DEFAULT_MARKET_CODE: MarketCode = "SA";

/** Stable DB primary keys — kept in sync with migrations/seed (Phase X1). */
export const MARKET_IDS = {
  SA: "market_sa",
  OM: "market_om",
  EG: "market_eg",
  GLOBAL: "market_global",
} as const satisfies Record<MarketCode, string>;

export const DEFAULT_MARKET_ID = MARKET_IDS.SA;

export type MarketScope = {
  id: string;
  code: MarketCode;
  defaultCurrency: string;
};

export function getMarketId(code: MarketCode): string {
  return MARKET_IDS[code];
}

export function isMarketCode(value: string): value is MarketCode {
  return (MARKET_CODES as readonly string[]).includes(value);
}

export function getMarketDefinition(code: MarketCode): MarketDefinition {
  const found = MARKET_DEFINITIONS.find((m) => m.code === code);
  if (!found) throw new Error(`Unknown market code: ${code}`);
  return found;
}

export function getMarketBySubdomain(subdomain: string): MarketDefinition | null {
  const normalized = subdomain.trim().toLowerCase();
  return MARKET_DEFINITIONS.find((m) => m.subdomain === normalized) ?? null;
}

export function resolveMarketFromGeoCountry(countryCode: string | null | undefined): MarketCode {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc) return "GLOBAL";
  const direct = MARKET_DEFINITIONS.find((m) => m.geoCountryCodes.includes(cc));
  if (direct) return direct.code;
  return "GLOBAL";
}

export function getMarketCodeById(marketId: string): MarketCode | null {
  const entry = Object.entries(MARKET_IDS).find(([, id]) => id === marketId);
  return entry ? (entry[0] as MarketCode) : null;
}

/** Country on the shipping address → which marketplace should fulfill the order. */
export function resolveDeliveryMarketForCountry(countryCode: string | null | undefined): MarketCode {
  return resolveMarketFromGeoCountry(countryCode);
}

export function isShippingCountryAllowedForMarket(
  countryCode: string | null | undefined,
  activeMarketCode: MarketCode,
): boolean {
  return resolveDeliveryMarketForCountry(countryCode) === activeMarketCode;
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
