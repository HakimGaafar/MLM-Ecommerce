import { prisma } from "@mlm/db";
import {
  DEFAULT_MARKET_CODE,
  MARKET_DEFINITIONS,
  isMarketCode,
  isMarketCodeFormat,
  type MarketCode,
} from "@mlm/shared";

export type MarketRouteRow = {
  id: string;
  code: string;
  subdomain: string;
  isActive: boolean;
  geoCountryCodes: string[];
  defaultCurrency: string;
  nameEn: string;
  nameAr: string;
};

export type MarketRoutingReadiness = {
  marketCode: string;
  subdomain: string;
  geoCountryCodes: string[];
  /** App DB: subdomain row resolves to this market. */
  hostBound: boolean;
  /** App DB: geo countries resolve to this market. */
  geoBound: boolean;
  /** Admin attested DNS/host already points at the platform. */
  hostRoutingConfirmed: boolean;
  hostRoutingConfirmedAt: string | null;
  /**
   * Publish-ready routing: DB bind + last successful live DNS/host verification.
   * Publish also re-runs DNS verification at go-live time.
   */
  routingOk: boolean;
  detail: {
    hostResolvesTo: string | null;
    geoResolvesTo: Record<string, string | null>;
  };
};

function staticCodeFromSubdomain(subdomain: string): string | null {
  const def = MARKET_DEFINITIONS.find((m) => m.subdomain === subdomain.trim().toLowerCase());
  return def?.code ?? null;
}

function staticCodeFromGeo(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!cc) return DEFAULT_MARKET_CODE;
  const direct = MARKET_DEFINITIONS.find((m) => m.geoCountryCodes.includes(cc));
  return direct?.code ?? "GLOBAL";
}

/** Resolve market code from subdomain using DB first, then static definitions. */
export async function resolveMarketCodeBySubdomain(
  subdomain: string | null | undefined,
): Promise<string | null> {
  const sub = subdomain?.trim().toLowerCase();
  if (!sub) return null;

  try {
    const row = await prisma.market.findUnique({
      where: { subdomain: sub },
      select: { code: true },
    });
    if (row?.code && isMarketCodeFormat(row.code)) return row.code;
  } catch {
    // fall through
  }
  return staticCodeFromSubdomain(sub);
}

/**
 * Resolve market from visitor country.
 * Prefer an active market that claims this geo; else inactive claim; else static; else GLOBAL.
 */
export async function resolveMarketCodeByGeoCountry(
  countryCode: string | null | undefined,
): Promise<string> {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || cc === "XX" || cc === "T1") return "GLOBAL";

  try {
    const active = await prisma.market.findFirst({
      where: {
        isActive: true,
        NOT: { code: "GLOBAL" },
        geoCountryCodes: { has: cc },
      },
      orderBy: { sortOrder: "asc" },
      select: { code: true },
    });
    if (active?.code && isMarketCodeFormat(active.code)) return active.code;

    const anyClaim = await prisma.market.findFirst({
      where: {
        NOT: { code: "GLOBAL" },
        geoCountryCodes: { has: cc },
      },
      orderBy: { sortOrder: "asc" },
      select: { code: true, isActive: true },
    });
    // Inactive claim still "belongs" to that market for readiness checks; traffic falls to GLOBAL/default via isActive gates.
    if (anyClaim?.code && isMarketCodeFormat(anyClaim.code)) {
      return anyClaim.isActive ? anyClaim.code : anyClaim.code;
    }
  } catch {
    // fall through
  }

  return staticCodeFromGeo(cc);
}

/** Active-only geo resolve for public traffic (inactive home → GLOBAL). */
export async function resolveActiveMarketCodeByGeoCountry(
  countryCode: string | null | undefined,
): Promise<string> {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || cc === "XX" || cc === "T1") return "GLOBAL";

  try {
    const active = await prisma.market.findFirst({
      where: {
        isActive: true,
        NOT: { code: "GLOBAL" },
        geoCountryCodes: { has: cc },
      },
      orderBy: { sortOrder: "asc" },
      select: { code: true },
    });
    if (active?.code && isMarketCodeFormat(active.code)) return active.code;
  } catch {
    // fall through
  }

  const fallback = staticCodeFromGeo(cc);
  if (fallback !== "GLOBAL") {
    // Static known market may be inactive in DB — caller checks isActive.
    return fallback;
  }
  return "GLOBAL";
}

export async function getMarketByCode(code: string): Promise<
  | (MarketRouteRow & {
      hostRoutingConfirmed: boolean;
      hostRoutingConfirmedAt: Date | null;
    })
  | null
> {
  const normalized = code.trim().toUpperCase();
  if (!isMarketCodeFormat(normalized)) return null;
  try {
    const row = await prisma.market.findUnique({
      where: { code: normalized },
      select: {
        id: true,
        code: true,
        subdomain: true,
        isActive: true,
        geoCountryCodes: true,
        defaultCurrency: true,
        nameEn: true,
        nameAr: true,
        hostRoutingConfirmed: true,
        hostRoutingConfirmedAt: true,
      },
    });
    return row;
  } catch {
    return null;
  }
}

/**
 * Publish gate: subdomain and geo countries must resolve (from DB) back to this market.
 * Does not require DNS — only app-level host/geo binding.
 */
export async function getMarketRoutingReadiness(marketCode: string): Promise<MarketRoutingReadiness> {
  const market = await getMarketByCode(marketCode);
  if (!market) {
    return {
      marketCode,
      subdomain: "",
      geoCountryCodes: [],
      hostBound: false,
      geoBound: false,
      hostRoutingConfirmed: false,
      hostRoutingConfirmedAt: null,
      routingOk: false,
      detail: { hostResolvesTo: null, geoResolvesTo: {} },
    };
  }

  const hostResolvesTo = market.subdomain
    ? await resolveMarketCodeBySubdomain(market.subdomain)
    : null;
  const hostBound = Boolean(market.subdomain) && hostResolvesTo === market.code;

  const geoResolvesTo: Record<string, string | null> = {};
  let geoBound = market.geoCountryCodes.length > 0;
  for (const geo of market.geoCountryCodes) {
    const resolved = await resolveMarketCodeByGeoCountry(geo);
    geoResolvesTo[geo] = resolved;
    if (resolved !== market.code) geoBound = false;
  }
  if (market.geoCountryCodes.length === 0) geoBound = false;

  const hostRoutingConfirmed = Boolean(market.hostRoutingConfirmed);

  return {
    marketCode: market.code,
    subdomain: market.subdomain,
    geoCountryCodes: market.geoCountryCodes,
    hostBound,
    geoBound,
    hostRoutingConfirmed,
    hostRoutingConfirmedAt: market.hostRoutingConfirmedAt?.toISOString() ?? null,
    routingOk: hostBound && geoBound && hostRoutingConfirmed,
    detail: { hostResolvesTo, geoResolvesTo },
  };
}
