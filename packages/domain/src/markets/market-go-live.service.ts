import { prisma } from "@mlm/db";
import {
  CUSTOMER_SIGNUP_DOCUMENT_TYPES,
  MARKET_IDS,
  MERCHANT_REGISTRATION_DOCUMENT_TYPES,
  TAP_COMPLIANCE_POLICY_PATHS,
  getMarketDefinition,
  isMarketCode,
  isMarketCodeFormat,
  isSeedMarketCode,
  resolveMarketFromGeoCountry,
  type MarketCode,
} from "@mlm/shared";
import { recordCurrentPolicyConsents } from "../legal/consent-ledger.service";

export class MarketGoLiveError extends Error {
  constructor(
    public readonly code:
      | "MARKET_NOT_FOUND"
      | "PAPERS_INCOMPLETE"
      | "PAYMENT_CURRENCY_MISSING"
      | "POLICIES_UNPUBLISHED"
      | "NO_PENDING_REACCEPT"
      | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MarketGoLiveError";
  }
}

export type MarketReadinessDto = {
  marketCode: MarketCode;
  papersOk: boolean;
  paymentOk: boolean;
  tapPoliciesPublished: boolean;
  canOpen: boolean;
  blockers: string[];
  missing: {
    papers: string[];
    payment: string[];
    policies: string[];
  };
};

export type MarketGoLiveResult = {
  marketCode: MarketCode;
  isActive: boolean;
  migratedVendors: number;
  flaggedUsers: number;
};

const TAP_DOCUMENT_TYPES = [
  "TERMS",
  "PRIVACY",
  "RETURNS",
  "SHIPPING",
  "PRICING_PAYMENT",
] as const;

/** Runtime primary market: closed home markets park on GLOBAL until opened. DB geo claims win. */
export async function resolvePrimaryMarketCodeForCountry(
  countryCode: string | null | undefined,
): Promise<MarketCode> {
  const { resolveActiveMarketCodeByGeoCountry } = await import("./market-routing.service");
  const fromDb = await resolveActiveMarketCodeByGeoCountry(countryCode);
  if (fromDb !== "GLOBAL" && isMarketCodeFormat(fromDb)) {
    return fromDb as MarketCode;
  }

  const natural = resolveMarketFromGeoCountry(countryCode);
  if (natural === "GLOBAL") return "GLOBAL";
  try {
    const row = await prisma.market.findUnique({
      where: { code: natural },
      select: { isActive: true },
    });
    if (row && !row.isActive) return "GLOBAL";
    if (row?.isActive) return natural;
  } catch {
    // fall through to launch defaults
  }
  const { MARKET_LAUNCH_ACTIVE } = await import("@mlm/shared");
  return MARKET_LAUNCH_ACTIVE[natural] ? natural : "GLOBAL";
}

export async function resolvePrimaryMarketIdForCountry(
  countryCode: string | null | undefined,
): Promise<string> {
  const code = await resolvePrimaryMarketCodeForCountry(countryCode);
  if (isSeedMarketCode(code)) return MARKET_IDS[code];
  const row = await prisma.market.findUnique({
    where: { code },
    select: { id: true },
  });
  if (row) return row.id;
  return MARKET_IDS.GLOBAL;
}

export async function getMarketReadiness(
  marketCode: MarketCode | string,
): Promise<MarketReadinessDto> {
  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: {
      id: true,
      code: true,
      defaultCurrency: true,
      paymentCurrencies: true,
      invoiceIssuer: {
        select: {
          legalNameEn: true,
          commercialRegistration: true,
          unifiedNumber: true,
          addressLine1: true,
          city: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!market) {
    throw new MarketGoLiveError("MARKET_NOT_FOUND");
  }

  const issuer = market.invoiceIssuer;
  const missingPapers: string[] = [];
  if (!issuer?.legalNameEn?.trim()) missingPapers.push("legalNameEn");
  if (!issuer?.commercialRegistration?.trim() && !issuer?.unifiedNumber?.trim()) {
    missingPapers.push("commercialRegistration");
  }
  if (!issuer?.addressLine1?.trim()) missingPapers.push("addressLine1");
  if (!issuer?.city?.trim()) missingPapers.push("city");
  if (!issuer?.email?.trim() && !issuer?.phone?.trim()) missingPapers.push("contact");
  const papersOk = missingPapers.length === 0;

  const currencies = market.paymentCurrencies?.length
    ? market.paymentCurrencies
    : [market.defaultCurrency];
  const missingPayment: string[] = [];
  if (!currencies.includes(market.defaultCurrency)) {
    missingPayment.push(market.defaultCurrency);
  }
  const paymentOk = missingPayment.length === 0;

  const published = await prisma.legalPolicyVersion.findMany({
    where: {
      marketId: market.id,
      documentType: { in: [...TAP_DOCUMENT_TYPES] },
      isCurrent: true,
      publishedAt: { not: null },
    },
    select: { documentType: true },
  });
  const publishedSet = new Set(published.map((row) => row.documentType));
  const missingPolicies = TAP_DOCUMENT_TYPES.filter((doc) => !publishedSet.has(doc));
  const tapPoliciesPublished = missingPolicies.length === 0;

  const blockers: string[] = [];
  if (!papersOk) blockers.push("PAPERS_INCOMPLETE");
  if (!paymentOk) blockers.push("PAYMENT_CURRENCY_MISSING");

  return {
    marketCode: (isMarketCode(market.code) ? market.code : marketCode) as MarketCode,
    papersOk,
    paymentOk,
    tapPoliciesPublished,
    canOpen: blockers.length === 0,
    blockers,
    missing: {
      papers: missingPapers,
      payment: missingPayment,
      policies: [...missingPolicies],
    },
  };
}

export async function assertMarketReadyToOpen(marketCode: MarketCode | string): Promise<void> {
  const readiness = await getMarketReadiness(marketCode);
  if (!readiness.papersOk) {
    throw new MarketGoLiveError(
      "PAPERS_INCOMPLETE",
      "Complete annex company papers (name, CR/unified number, address, contact) before opening this market.",
    );
  }
  if (!readiness.paymentOk) {
    const market = await prisma.market.findUnique({
      where: { code: marketCode },
      select: { defaultCurrency: true },
    });
    const currency =
      market?.defaultCurrency ??
      (isSeedMarketCode(marketCode)
        ? getMarketDefinition(marketCode).defaultCurrency
        : String(marketCode));
    throw new MarketGoLiveError(
      "PAYMENT_CURRENCY_MISSING",
      `Add ${currency} to payment currencies before opening this market.`,
    );
  }
}

/**
 * Move GLOBAL-parked vendors whose country belongs to the newly opened market
 * onto that market's primaryMarketId (and store marketId when still GLOBAL).
 */
export async function migrateGlobalVendorsToMarket(params: {
  marketId: string;
  marketCode: string;
}): Promise<{ vendorIds: string[]; ownerUserIds: string[] }> {
  const market = await prisma.market.findUnique({
    where: { id: params.marketId },
    select: { geoCountryCodes: true },
  });
  let geo = (market?.geoCountryCodes ?? []).map((c) => c.toUpperCase());
  if (geo.length === 0 && isSeedMarketCode(params.marketCode)) {
    geo = getMarketDefinition(params.marketCode).geoCountryCodes.map((c) => c.toUpperCase());
  }
  if (geo.length === 0) {
    return { vendorIds: [], ownerUserIds: [] };
  }

  const vendors = await prisma.vendor.findMany({
    where: {
      primaryMarketId: MARKET_IDS.GLOBAL,
      countryCode: { in: geo },
    },
    select: { id: true, ownerUserId: true, marketId: true },
  });
  if (vendors.length === 0) {
    return { vendorIds: [], ownerUserIds: [] };
  }

  await prisma.$transaction(
    vendors.map((v) =>
      prisma.vendor.update({
        where: { id: v.id },
        data: {
          primaryMarketId: params.marketId,
          ...(v.marketId === MARKET_IDS.GLOBAL ? { marketId: params.marketId } : {}),
        },
      }),
    ),
  );

  return {
    vendorIds: vendors.map((v) => v.id),
    ownerUserIds: [...new Set(vendors.map((v) => v.ownerUserId))],
  };
}

/**
 * Flag merchants (and any listed users) so they re-accept policies under MARKET_REACCEPT.
 */
export async function flagUsersForMarketReaccept(params: {
  marketId: string;
  userIds: string[];
}): Promise<number> {
  if (params.userIds.length === 0) return 0;
  const result = await prisma.user.updateMany({
    where: { id: { in: params.userIds } },
    data: {
      pendingMarketReacceptId: params.marketId,
      pendingMarketReacceptAt: new Date(),
    },
  });
  return result.count;
}

/** Also flag merchants whose primary is already this market (edge: re-open). */
export async function flagPrimaryMarketMerchantsForReaccept(marketId: string): Promise<number> {
  const vendors = await prisma.vendor.findMany({
    where: { primaryMarketId: marketId },
    select: { ownerUserId: true },
    distinct: ["ownerUserId"],
  });
  return flagUsersForMarketReaccept({
    marketId,
    userIds: vendors.map((v) => v.ownerUserId),
  });
}

export async function openMarketGoLive(marketCode: MarketCode | string): Promise<MarketGoLiveResult> {
  await assertMarketReadyToOpen(marketCode);

  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: { id: true, code: true, isActive: true },
  });
  if (!market) {
    throw new MarketGoLiveError("MARKET_NOT_FOUND");
  }

  if (!market.isActive) {
    await prisma.market.update({
      where: { id: market.id },
      data: { isActive: true },
    });
  }

  const migrated = await migrateGlobalVendorsToMarket({
    marketId: market.id,
    marketCode,
  });
  const flagged = await flagUsersForMarketReaccept({
    marketId: market.id,
    userIds: migrated.ownerUserIds,
  });

  // Merchants already on this primary (if any) also re-accept on open.
  const primaryFlagged = await flagPrimaryMarketMerchantsForReaccept(market.id);

  return {
    marketCode: (isMarketCode(market.code) ? market.code : market.code) as MarketCode,
    isActive: true,
    migratedVendors: migrated.vendorIds.length,
    flaggedUsers: Math.max(flagged, primaryFlagged),
  };
}

export async function getPendingMarketReaccept(userId: string): Promise<{
  marketId: string;
  marketCode: string;
  flaggedAt: string;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pendingMarketReacceptId: true,
      pendingMarketReacceptAt: true,
      pendingMarketReaccept: { select: { code: true } },
    },
  });
  if (!user?.pendingMarketReacceptId || !user.pendingMarketReaccept) return null;
  const code = user.pendingMarketReaccept.code.trim().toUpperCase();
  // Accept DB markets (AE, …) — not only the static SA/OM/EG/GLOBAL set.
  if (!isMarketCodeFormat(code)) return null;
  return {
    marketId: user.pendingMarketReacceptId,
    marketCode: code,
    flaggedAt: (user.pendingMarketReacceptAt ?? new Date()).toISOString(),
  };
}

/** Record merchant pack (or customer signup pair) under MARKET_REACCEPT and clear the flag. */
export async function completeMarketReaccept(params: {
  userId: string;
  remoteIp?: string | null;
  userAgent?: string | null;
}): Promise<{ marketCode: string }> {
  const pending = await getPendingMarketReaccept(params.userId);
  if (!pending) {
    throw new MarketGoLiveError("NO_PENDING_REACCEPT", "No market re-acceptance is pending.");
  }

  const isVendor = await prisma.vendor.findFirst({
    where: { ownerUserId: params.userId },
    select: { id: true },
  });

  const documentTypes = isVendor
    ? MERCHANT_REGISTRATION_DOCUMENT_TYPES
    : CUSTOMER_SIGNUP_DOCUMENT_TYPES;

  await recordCurrentPolicyConsents({
    userId: params.userId,
    marketId: pending.marketId,
    context: "MARKET_REACCEPT",
    documentTypes,
    vendorId: isVendor?.id ?? null,
    ipAddress: params.remoteIp,
    userAgent: params.userAgent,
  });

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      pendingMarketReacceptId: null,
      pendingMarketReacceptAt: null,
    },
  });

  return { marketCode: pending.marketCode };
}

/** Tap's five policy URLs — only when market is active. */
export async function getLiveTapComplianceUrls(params: {
  marketId: string;
  requirePublished?: boolean;
}): Promise<{ live: boolean; paths: string[]; marketCode: string | null }> {
  const market = await prisma.market.findUnique({
    where: { id: params.marketId },
    select: { id: true, code: true, isActive: true },
  });
  if (!market?.isActive) {
    return { live: false, paths: [], marketCode: market?.code ?? null };
  }

  if (params.requirePublished) {
    const published = await prisma.legalPolicyVersion.count({
      where: {
        marketId: market.id,
        documentType: { in: [...TAP_DOCUMENT_TYPES] },
        isCurrent: true,
        publishedAt: { not: null },
      },
    });
    if (published < TAP_DOCUMENT_TYPES.length) {
      return { live: false, paths: [], marketCode: market.code };
    }
  }

  return {
    live: true,
    paths: [...TAP_COMPLIANCE_POLICY_PATHS],
    marketCode: market.code,
  };
}

/** Active market IDs for offer editors / public surfaces. */
export async function listActiveMarketIds(): Promise<string[]> {
  const markets = await listActiveMarketsForOffers();
  return markets.map((m) => m.id);
}

export type ActiveMarketOfferOption = {
  id: string;
  code: string;
  defaultCurrency: string;
};

/** Active markets with code/currency for vendor offer editors. */
export async function listActiveMarketsForOffers(): Promise<ActiveMarketOfferOption[]> {
  try {
    const rows = await prisma.market.findMany({
      where: { isActive: true },
      select: { id: true, code: true, defaultCurrency: true },
      orderBy: { sortOrder: "asc" },
    });
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        defaultCurrency: r.defaultCurrency,
      }));
    }
  } catch {
    // fall through
  }
  const { listLaunchActiveMarketDefinitions, MARKET_IDS: ids } = await import("@mlm/shared");
  return listLaunchActiveMarketDefinitions().map((d) => ({
    id: ids[d.code],
    code: d.code,
    defaultCurrency: d.defaultCurrency,
  }));
}
