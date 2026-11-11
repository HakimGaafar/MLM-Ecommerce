import { prisma } from "@mlm/db";
import type {
  AdminMarketWizardCommercialInput,
  AdminMarketWizardIdentityInput,
  AddMarketCountryOption,
  MarketCode,
  MarketLifecycleStatus,
} from "@mlm/shared";
import {
  ADD_MARKET_COUNTRY_CATALOG,
  ADD_MARKET_CURRENCY_OPTIONS,
  DEFAULT_MARKET_CODE,
  getAddMarketCountryOption,
  isMarketCode,
  isMarketCodeFormat,
  isPaymentCurrencyGatewaySupported,
  MARKET_CODES,
} from "@mlm/shared";
import { checkPaymentCurrenciesForPublish } from "../markets/gateway-currency.service";
import {
  MarketGoLiveError,
  openMarketGoLive,
} from "../markets/market-go-live.service";
import {
  MarketPackError,
  provisionMarketPack,
  publishCurrentLegalPolicies,
} from "../markets/market-pack.service";
import {
  getMarketRoutingReadiness,
  type MarketRoutingReadiness,
} from "../markets/market-routing.service";
import {
  verifyMarketHostDns,
  type HostDnsVerifyResult,
} from "../markets/host-dns-verify.service";

export class AdminMarketWizardError extends Error {
  constructor(
    public readonly code:
      | "MARKET_NOT_FOUND"
      | "MARKET_EXISTS"
      | "COUNTRY_UNAVAILABLE"
      | "ALREADY_LIVE"
      | "NOT_READY"
      | "GATEWAY_CURRENCY_UNSUPPORTED"
      | "PAPERS_INCOMPLETE"
      | "PAYMENT_CURRENCY_MISSING"
      | "POLICIES_INCOMPLETE"
      | "CONFIG_MISSING"
      | "REFUND_RULES_MISSING"
      | "INVOICING_RULES_MISSING"
      | "SHIPPING_RATES_MISSING"
      | "ROUTING_NOT_BOUND"
      | "DNS_NOT_VERIFIED"
      | "HAS_VENDORS"
      | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminMarketWizardError";
  }
}

export type WizardChecklistItem = {
  id: string;
  ok: boolean;
  detail?: string;
};

export type MarketWizardStateDto = {
  marketCode: string;
  marketId: string;
  lifecycleStatus: MarketLifecycleStatus;
  isActive: boolean;
  papersComplete: boolean;
  cloneSourceCode: string | null;
  currencyOptions: string[];
  identity: {
    nameEn: string;
    nameAr: string;
    subdomain: string;
    defaultCurrency: string;
    paymentCurrencies: string[];
    geoCountryCodes: string[];
  };
  commercial: {
    platformRate: number;
    platformRateCross: number;
    returnWindowDays: number;
    settlementWindowDays: number;
    codEnabled: boolean;
    vatRate: number;
  } | null;
  gateway: ReturnType<typeof checkPaymentCurrenciesForPublish>;
  routing: MarketRoutingReadiness;
  checklist: WizardChecklistItem[];
  canMarkReady: boolean;
  canPublish: boolean;
  blockers: string[];
};

function asLifecycle(value: string): MarketLifecycleStatus {
  if (value === "DRAFT" || value === "READY" || value === "LIVE" || value === "SUSPENDED") {
    return value;
  }
  return "DRAFT";
}

/** Country codes / market codes already claimed — cannot appear in Add Market. */
export async function listTakenMarketCountryCodes(): Promise<Set<string>> {
  const rows = await prisma.market.findMany({
    select: { code: true, geoCountryCodes: true },
  });
  const taken = new Set<string>();
  for (const row of rows) {
    const code = row.code.trim().toUpperCase();
    if (code && code !== "GLOBAL") taken.add(code);
    for (const geo of row.geoCountryCodes) {
      const cc = geo.trim().toUpperCase();
      if (cc) taken.add(cc);
    }
  }
  return taken;
}

/** Countries available to add (catalog minus existing markets / geo claims). */
export async function listAvailableAddMarketCountries(): Promise<AddMarketCountryOption[]> {
  const taken = await listTakenMarketCountryCodes();
  return ADD_MARKET_COUNTRY_CATALOG.filter(
    (row) => !taken.has(row.countryCode) && !taken.has(row.marketCode),
  );
}

export type WizardDraftSummary = {
  marketCode: string;
  nameEn: string;
  nameAr: string;
  lifecycleStatus: MarketLifecycleStatus;
  subdomain: string;
  updatedAt: string;
};

/** Incomplete wizard markets (DRAFT/READY) that can be resumed or deleted. */
export async function listWizardDraftMarkets(): Promise<WizardDraftSummary[]> {
  const seed = new Set<string>(MARKET_CODES as readonly string[]);
  const rows = await prisma.market.findMany({
    where: {
      lifecycleStatus: { in: ["DRAFT", "READY"] },
      isActive: false,
    },
    select: {
      code: true,
      nameEn: true,
      nameAr: true,
      lifecycleStatus: true,
      subdomain: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .filter((row) => !seed.has(row.code))
    .map((row) => ({
      marketCode: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      lifecycleStatus: asLifecycle(row.lifecycleStatus),
      subdomain: row.subdomain,
      updatedAt: row.updatedAt.toISOString(),
    }));
}

/**
 * Delete an unfinished wizard market (DRAFT/READY only). Seed markets cannot be deleted.
 * Cascades pack rows; blocked if any vendor is attached.
 */
export async function deleteWizardDraftMarket(marketCode: string): Promise<void> {
  const code = marketCode.trim().toUpperCase();
  if (!isMarketCodeFormat(code)) {
    throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  }
  if ((MARKET_CODES as readonly string[]).includes(code)) {
    throw new AdminMarketWizardError("FORBIDDEN", "Seed markets cannot be deleted from the wizard.");
  }

  const market = await prisma.market.findUnique({
    where: { code },
    select: {
      id: true,
      lifecycleStatus: true,
      isActive: true,
      _count: { select: { vendors: true, primaryVendors: true } },
    },
  });
  if (!market) throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  if (market.isActive || market.lifecycleStatus === "LIVE") {
    throw new AdminMarketWizardError("ALREADY_LIVE", "Live markets cannot be deleted from the wizard.");
  }
  if (market.lifecycleStatus !== "DRAFT" && market.lifecycleStatus !== "READY") {
    throw new AdminMarketWizardError("FORBIDDEN", "Only DRAFT or READY wizard markets can be deleted.");
  }
  if (market._count.vendors > 0 || market._count.primaryVendors > 0) {
    throw new AdminMarketWizardError("HAS_VENDORS", "Market has vendors; cannot delete.");
  }

  await prisma.user.updateMany({
    where: { pendingMarketReacceptId: market.id },
    data: { pendingMarketReacceptId: null, pendingMarketReacceptAt: null },
  });

  await prisma.market.delete({ where: { id: market.id } });
}

async function createDraftMarketFromCountry(params: {
  countryCode: string;
  cloneFrom: MarketCode;
}): Promise<{ marketCode: string }> {
  const option = getAddMarketCountryOption(params.countryCode);
  if (!option) {
    throw new AdminMarketWizardError(
      "COUNTRY_UNAVAILABLE",
      "This country is not available in the Add Market catalog.",
    );
  }
  if (!isPaymentCurrencyGatewaySupported(option.defaultCurrency)) {
    throw new AdminMarketWizardError(
      "GATEWAY_CURRENCY_UNSUPPORTED",
      `Default currency ${option.defaultCurrency} is not supported by installed card gateways.`,
    );
  }

  const taken = await listTakenMarketCountryCodes();
  if (taken.has(option.countryCode) || taken.has(option.marketCode)) {
    throw new AdminMarketWizardError(
      "MARKET_EXISTS",
      "A market for this country already exists. Edit or re-enable it from Markets.",
    );
  }

  const existingCode = await prisma.market.findUnique({
    where: { code: option.marketCode },
    select: { id: true },
  });
  if (existingCode) {
    throw new AdminMarketWizardError("MARKET_EXISTS", "Market code already exists.");
  }

  const subdomainTaken = await prisma.market.findUnique({
    where: { subdomain: option.subdomain },
    select: { id: true },
  });
  if (subdomainTaken) {
    throw new AdminMarketWizardError(
      "MARKET_EXISTS",
      `Subdomain "${option.subdomain}" is already in use.`,
    );
  }

  const maxSort = await prisma.market.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.market.create({
    data: {
      code: option.marketCode,
      subdomain: option.subdomain,
      nameEn: option.nameEn,
      nameAr: option.nameAr,
      defaultCurrency: option.defaultCurrency,
      paymentCurrencies: [option.defaultCurrency],
      geoCountryCodes: [option.countryCode],
      isActive: false,
      lifecycleStatus: "DRAFT",
      papersComplete: false,
      cloneSourceCode: params.cloneFrom,
      sortOrder,
    },
  });

  return { marketCode: option.marketCode };
}

export async function startMarketWizard(params: {
  countryCode: string;
  cloneFrom?: MarketCode;
}): Promise<MarketWizardStateDto> {
  const cloneFrom = params.cloneFrom ?? "OM";
  const { marketCode } = await createDraftMarketFromCountry({
    countryCode: params.countryCode,
    cloneFrom,
  });

  try {
    await provisionMarketPack({ marketCode, cloneFrom });
  } catch (error) {
    if (error instanceof MarketPackError) {
      throw new AdminMarketWizardError("MARKET_NOT_FOUND", error.message);
    }
    throw error;
  }

  return getMarketWizardState(marketCode);
}

export async function getMarketWizardState(marketCode: string): Promise<MarketWizardStateDto> {
  const normalized = marketCode.trim().toUpperCase();
  if (!isMarketCodeFormat(normalized)) {
    throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  }

  const market = await prisma.market.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      nameEn: true,
      nameAr: true,
      subdomain: true,
      defaultCurrency: true,
      paymentCurrencies: true,
      geoCountryCodes: true,
      isActive: true,
      lifecycleStatus: true,
      papersComplete: true,
      cloneSourceCode: true,
    },
  });
  if (!market) {
    throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  }

  const paymentCurrencies =
    market.paymentCurrencies.length > 0
      ? market.paymentCurrencies
      : [market.defaultCurrency];

  const [config, issuer, policyCount, refundCount, invoicingCount, shippingCount, routing] =
    await Promise.all([
      prisma.platformConfig.findUnique({
        where: { marketId: market.id },
        select: {
          platformRate: true,
          platformRateCross: true,
          returnWindowDays: true,
          settlementWindowDays: true,
          codEnabled: true,
          vatRate: true,
        },
      }),
      prisma.marketInvoiceIssuer.findUnique({
        where: { marketId: market.id },
        select: {
          legalNameEn: true,
          commercialRegistration: true,
          unifiedNumber: true,
          addressLine1: true,
          city: true,
          email: true,
          phone: true,
        },
      }),
      prisma.legalPolicyVersion.count({
        where: {
          marketId: market.id,
          isCurrent: true,
          publishedAt: { not: null },
          documentType: {
            in: ["TERMS", "PRIVACY", "RETURNS", "SHIPPING", "PRICING_PAYMENT"],
          },
        },
      }),
      prisma.refundFeeRule.count({ where: { marketId: market.id } }),
      prisma.marketInvoicingRule.count({
        where: { OR: [{ sellerMarketId: market.id }, { buyerMarketId: market.id }] },
      }),
      prisma.shippingRate.count({ where: { marketId: market.id, isActive: true } }),
      getMarketRoutingReadiness(market.code),
    ]);

  const gateway = checkPaymentCurrenciesForPublish(paymentCurrencies);

  const papersFieldsOk = Boolean(
    issuer?.legalNameEn?.trim() &&
      issuer.legalNameEn !== "Pending legal name" &&
      (issuer.commercialRegistration?.trim() || issuer.unifiedNumber?.trim()) &&
      issuer.addressLine1?.trim() &&
      issuer.addressLine1 !== "Pending address" &&
      issuer.city?.trim() &&
      issuer.city !== "Pending" &&
      (issuer.email?.trim() || issuer.phone?.trim()),
  );
  const paymentOk = paymentCurrencies.includes(market.defaultCurrency);
  const policiesOk = policyCount >= 5;
  const configOk = Boolean(config);
  const refundOk = refundCount >= 5;
  const invoicingOk = invoicingCount > 0;
  const shippingOk = shippingCount > 0;
  const papersFlagOk = market.papersComplete;

  const checklist: WizardChecklistItem[] = [
    { id: "identity", ok: Boolean(market.nameEn && market.defaultCurrency && paymentOk) },
    { id: "annex", ok: papersFieldsOk, detail: papersFieldsOk ? undefined : "Complete company annex" },
    { id: "commercial", ok: configOk },
    {
      id: "payments",
      ok: gateway.canPublish && paymentOk,
      detail: gateway.uncovered.length
        ? `Unsupported: ${gateway.uncovered.join(", ")}`
        : undefined,
    },
    { id: "shipping", ok: shippingOk, detail: shippingOk ? undefined : "Clone or add shipping rates" },
    {
      id: "legal",
      ok: policiesOk,
      detail: policiesOk ? undefined : "Publish Tap policy set (or publish on go-live)",
    },
    {
      id: "papers",
      ok: papersFlagOk && papersFieldsOk,
      detail: papersFlagOk ? undefined : "Confirm papers complete",
    },
    { id: "refund_rules", ok: refundOk },
    { id: "invoicing_rules", ok: invoicingOk },
    {
      id: "routing_app",
      ok: routing.hostBound && routing.geoBound,
      detail:
        routing.hostBound && routing.geoBound
          ? `${routing.subdomain} + geo bound in app`
          : "Set subdomain + geo countries (identity) so the app knows this market",
    },
    {
      id: "routing_dns",
      ok: routing.hostRoutingConfirmed,
      detail: routing.hostRoutingConfirmed
        ? "Live DNS/host verify passed (required for go-live, not for READY)"
        : "Optional for READY — run Verify DNS before Publish / go-live",
    },
  ];

  // READY = pack complete + app host/geo bind. DNS verify is NOT required for READY.
  const readyBlockers: string[] = [];
  if (!papersFieldsOk || !papersFlagOk) readyBlockers.push("PAPERS_INCOMPLETE");
  if (!paymentOk) readyBlockers.push("PAYMENT_CURRENCY_MISSING");
  if (!gateway.canPublish) readyBlockers.push("GATEWAY_CURRENCY_UNSUPPORTED");
  if (!configOk) readyBlockers.push("CONFIG_MISSING");
  if (!refundOk) readyBlockers.push("REFUND_RULES_MISSING");
  if (!invoicingOk) readyBlockers.push("INVOICING_RULES_MISSING");
  if (!shippingOk) readyBlockers.push("SHIPPING_RATES_MISSING");
  if (!routing.hostBound || !routing.geoBound) readyBlockers.push("ROUTING_NOT_BOUND");

  const legalDraftCount = await prisma.legalPolicyVersion.count({
    where: {
      marketId: market.id,
      isCurrent: true,
      documentType: {
        in: ["TERMS", "PRIVACY", "RETURNS", "SHIPPING", "PRICING_PAYMENT"],
      },
    },
  });
  if (legalDraftCount < 5) readyBlockers.push("POLICIES_INCOMPLETE");

  // Publish blockers = READY pack + successful DNS attestation (publish also re-verifies live).
  const blockers = [...readyBlockers];
  if (!routing.hostRoutingConfirmed) blockers.push("DNS_NOT_VERIFIED");

  const canMarkReady = readyBlockers.length === 0;
  const canPublish =
    canMarkReady &&
    routing.routingOk &&
    market.lifecycleStatus !== "LIVE";

  const selected = new Set(paymentCurrencies.map((c) => c.toUpperCase()));
  const currencyOptions = ADD_MARKET_CURRENCY_OPTIONS.filter((c) => !selected.has(c));

  return {
    marketCode: market.code,
    marketId: market.id,
    lifecycleStatus: asLifecycle(market.lifecycleStatus),
    isActive: market.isActive,
    papersComplete: market.papersComplete,
    cloneSourceCode: market.cloneSourceCode,
    currencyOptions: [...currencyOptions],
    identity: {
      nameEn: market.nameEn,
      nameAr: market.nameAr,
      subdomain: market.subdomain,
      defaultCurrency: market.defaultCurrency,
      paymentCurrencies,
      geoCountryCodes: market.geoCountryCodes,
    },
    commercial: config
      ? {
          platformRate: Number(config.platformRate),
          platformRateCross: Number(config.platformRateCross),
          returnWindowDays: config.returnWindowDays,
          settlementWindowDays: config.settlementWindowDays,
          codEnabled: config.codEnabled,
          vatRate: Number(config.vatRate),
        }
      : null,
    gateway,
    routing,
    checklist,
    canMarkReady,
    canPublish,
    blockers,
  };
}

export async function updateWizardIdentity(
  marketCode: string,
  input: AdminMarketWizardIdentityInput,
): Promise<MarketWizardStateDto> {
  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: { id: true, defaultCurrency: true, paymentCurrencies: true, lifecycleStatus: true },
  });
  if (!market) throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  if (market.lifecycleStatus === "LIVE") {
    throw new AdminMarketWizardError("ALREADY_LIVE", "Live markets: edit identity from Markets list.");
  }

  const paymentCurrencies = input.paymentCurrencies;
  const defaultCurrency = input.defaultCurrency ?? market.defaultCurrency;
  if (paymentCurrencies && !paymentCurrencies.includes(defaultCurrency)) {
    throw new AdminMarketWizardError(
      "PAYMENT_CURRENCY_MISSING",
      "Default currency must be included in payment currencies.",
    );
  }
  if (paymentCurrencies) {
    const unsupported = paymentCurrencies.filter((c) => !isPaymentCurrencyGatewaySupported(c));
    if (unsupported.length > 0) {
      throw new AdminMarketWizardError(
        "GATEWAY_CURRENCY_UNSUPPORTED",
        `Unsupported payment currencies (not selectable): ${unsupported.join(", ")}`,
      );
    }
  }
  if (input.defaultCurrency && !isPaymentCurrencyGatewaySupported(input.defaultCurrency)) {
    throw new AdminMarketWizardError(
      "GATEWAY_CURRENCY_UNSUPPORTED",
      `Unsupported default currency: ${input.defaultCurrency}`,
    );
  }

  await prisma.market.update({
    where: { id: market.id },
    data: {
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.nameAr !== undefined ? { nameAr: input.nameAr } : {}),
      ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
      ...(input.paymentCurrencies !== undefined
        ? { paymentCurrencies: input.paymentCurrencies }
        : {}),
      ...(input.geoCountryCodes !== undefined ? { geoCountryCodes: input.geoCountryCodes } : {}),
      lifecycleStatus: "DRAFT",
      isActive: false,
    },
  });

  return getMarketWizardState(marketCode);
}

export async function updateWizardCommercial(
  marketCode: string,
  input: AdminMarketWizardCommercialInput,
): Promise<MarketWizardStateDto> {
  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: { id: true },
  });
  if (!market) throw new AdminMarketWizardError("MARKET_NOT_FOUND");

  const existing = await prisma.platformConfig.findUnique({ where: { marketId: market.id } });
  if (!existing) throw new AdminMarketWizardError("CONFIG_MISSING");

  await prisma.platformConfig.update({
    where: { marketId: market.id },
    data: {
      ...(input.platformRate !== undefined
        ? { platformRate: input.platformRate, vendorRate: 1 - input.platformRate }
        : {}),
      ...(input.platformRateCross !== undefined
        ? {
            platformRateCross: input.platformRateCross,
            vendorRateCross: 1 - input.platformRateCross,
          }
        : {}),
      ...(input.returnWindowDays !== undefined
        ? { returnWindowDays: input.returnWindowDays }
        : {}),
      ...(input.settlementWindowDays !== undefined
        ? { settlementWindowDays: input.settlementWindowDays }
        : {}),
      ...(input.codEnabled !== undefined ? { codEnabled: input.codEnabled } : {}),
      ...(input.vatRate !== undefined ? { vatRate: input.vatRate } : {}),
    },
  });

  return getMarketWizardState(marketCode);
}

export async function setWizardPapersComplete(
  marketCode: string,
  papersComplete: boolean,
): Promise<MarketWizardStateDto> {
  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: { id: true },
  });
  if (!market) throw new AdminMarketWizardError("MARKET_NOT_FOUND");

  await prisma.market.update({
    where: { id: market.id },
    data: { papersComplete },
  });
  return getMarketWizardState(marketCode);
}

/**
 * Live DNS/host verification (not a trust checkbox).
 * On success, persists hostRoutingConfirmed=true; on failure clears it.
 */
export async function verifyWizardHostDns(marketCode: string): Promise<{
  state: MarketWizardStateDto;
  dns: HostDnsVerifyResult;
}> {
  const dns = await verifyMarketHostDns({ marketCode, persist: true });
  const state = await getMarketWizardState(marketCode);
  return { state, dns };
}

/** @deprecated Prefer verifyWizardHostDns — blind confirm is no longer enough for publish. */
export async function setWizardHostRoutingConfirmed(
  marketCode: string,
  hostRoutingConfirmed: boolean,
): Promise<MarketWizardStateDto> {
  if (hostRoutingConfirmed) {
    const { state } = await verifyWizardHostDns(marketCode);
    return state;
  }
  const market = await prisma.market.findUnique({
    where: { code: marketCode },
    select: { id: true },
  });
  if (!market) throw new AdminMarketWizardError("MARKET_NOT_FOUND");
  await prisma.market.update({
    where: { id: market.id },
    data: { hostRoutingConfirmed: false, hostRoutingConfirmedAt: null },
  });
  return getMarketWizardState(marketCode);
}

export async function markMarketReady(marketCode: string): Promise<MarketWizardStateDto> {
  const state = await getMarketWizardState(marketCode);
  if (!state.canMarkReady) {
    throw new AdminMarketWizardError(
      "NOT_READY",
      `Checklist incomplete: ${state.blockers.join(", ")}`,
    );
  }
  await prisma.market.update({
    where: { id: state.marketId },
    data: { lifecycleStatus: "READY", isActive: false },
  });
  return getMarketWizardState(marketCode);
}

export async function publishMarketWizard(marketCode: string): Promise<{
  state: MarketWizardStateDto;
  migratedVendors: number;
  flaggedUsers: number;
}> {
  void DEFAULT_MARKET_CODE;

  let state = await getMarketWizardState(marketCode);
  if (state.lifecycleStatus === "LIVE" && state.isActive) {
    throw new AdminMarketWizardError("ALREADY_LIVE", "Market is already live.");
  }
  if (!state.canMarkReady) {
    throw new AdminMarketWizardError(
      "NOT_READY",
      `Cannot publish: ${state.blockers.join(", ")}`,
    );
  }
  if (!state.gateway.canPublish) {
    throw new AdminMarketWizardError(
      "GATEWAY_CURRENCY_UNSUPPORTED",
      `Unsupported payment currencies: ${state.gateway.uncovered.join(", ") || "none configured"}`,
    );
  }
  if (!state.routing.hostBound || !state.routing.geoBound) {
    throw new AdminMarketWizardError(
      "ROUTING_NOT_BOUND",
      "Host/geo app binding incomplete. Set subdomain + geo countries so visitors resolve to this market before publish.",
    );
  }

  // Live re-check DNS at publish time (do not trust a stale attestation).
  const dns = await verifyMarketHostDns({ marketCode, persist: true });
  if (!dns.ok) {
    throw new AdminMarketWizardError(
      "ROUTING_NOT_BOUND",
      `DNS/host verification failed for ${dns.hostname}: ${dns.detail}`,
    );
  }

  state = await getMarketWizardState(marketCode);
  if (!state.routing.routingOk) {
    throw new AdminMarketWizardError(
      "ROUTING_NOT_BOUND",
      "Routing checklist incomplete after DNS verification.",
    );
  }

  await publishCurrentLegalPolicies(state.marketId);

  try {
    const goLive = await openMarketGoLive(marketCode);
    await prisma.market.update({
      where: { id: state.marketId },
      data: { lifecycleStatus: "LIVE", isActive: true },
    });
    state = await getMarketWizardState(marketCode);
    return {
      state,
      migratedVendors: goLive.migratedVendors,
      flaggedUsers: goLive.flaggedUsers,
    };
  } catch (error) {
    if (error instanceof MarketGoLiveError) {
      throw new AdminMarketWizardError(
        error.code === "PAPERS_INCOMPLETE"
          ? "PAPERS_INCOMPLETE"
          : error.code === "PAYMENT_CURRENCY_MISSING"
            ? "PAYMENT_CURRENCY_MISSING"
            : "NOT_READY",
        error.message,
      );
    }
    throw error;
  }
}

/** @deprecated Use listAvailableAddMarketCountries — kept for API compat during UI swap. */
export async function listWizardEligibleMarkets() {
  return listAvailableAddMarketCountries();
}
