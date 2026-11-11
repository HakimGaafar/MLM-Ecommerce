import { prisma } from "@mlm/db";
import {
  DEFAULT_LEGAL_POLICY_VERSION,
  DEFAULT_REFUND_FEE_PAYERS,
  LEGAL_DOCUMENT_TITLES,
  LEGAL_DOCUMENT_TYPES,
  MARKET_IDS,
  REFUND_FEE_CAUSES,
  isMarketCode,
  isMarketCodeFormat,
  isSeedMarketCode,
  type MarketCode,
} from "@mlm/shared";

export class MarketPackError extends Error {
  constructor(
    public readonly code:
      | "MARKET_NOT_FOUND"
      | "SOURCE_NOT_FOUND"
      | "INVALID_CLONE_SOURCE"
      | "ALREADY_LIVE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MarketPackError";
  }
}

const DEFAULT_CLONE_SOURCE: MarketCode = "OM";

async function resolveMarketRow(code: string): Promise<{
  id: string;
  code: string;
  defaultCurrency: string;
  geoCountryCodes: string[];
}> {
  const normalized = code.trim().toUpperCase();
  if (!isMarketCodeFormat(normalized)) {
    throw new MarketPackError("MARKET_NOT_FOUND");
  }
  const row = await prisma.market.findUnique({
    where: { code: normalized },
    select: { id: true, code: true, defaultCurrency: true, geoCountryCodes: true },
  });
  if (!row) {
    throw new MarketPackError("MARKET_NOT_FOUND");
  }
  return row;
}

/** Ensure PlatformConfig exists — clone numeric commercial defaults from source. */
async function ensurePlatformConfig(params: {
  marketId: string;
  marketCode: string;
  sourceMarketId: string;
}) {
  const existing = await prisma.platformConfig.findUnique({
    where: { marketId: params.marketId },
    select: { marketId: true },
  });
  if (existing) return;

  const source = await prisma.platformConfig.findUnique({
    where: { marketId: params.sourceMarketId },
  });
  if (!source) {
    throw new MarketPackError("SOURCE_NOT_FOUND", "Clone source has no platform config.");
  }

  const vatByCode: Record<string, number> = {
    SA: 0.15,
    OM: 0.05,
    EG: 0,
    GLOBAL: 0.05,
  };

  await prisma.platformConfig.create({
    data: {
      marketId: params.marketId,
      cashbackRate: source.cashbackRate,
      affiliatePoolRate: source.affiliatePoolRate,
      affiliateLevel1Rate: source.affiliateLevel1Rate,
      affiliateLevel2Rate: source.affiliateLevel2Rate,
      affiliateLevel3Rate: source.affiliateLevel3Rate,
      affiliateLevel4Rate: source.affiliateLevel4Rate,
      vendorRate: source.vendorRate,
      platformRate: source.platformRate,
      platformRateCross: source.platformRateCross,
      vendorRateCross: source.vendorRateCross,
      vatRate: vatByCode[params.marketCode] ?? source.vatRate,
      minWithdrawalAmount: source.minWithdrawalAmount,
      returnWindowDays: source.returnWindowDays,
      settlementWindowDays: source.settlementWindowDays,
      referralDepthMax: source.referralDepthMax,
      missingAncestorPolicy: source.missingAncestorPolicy,
      sessionAccessMinutes: source.sessionAccessMinutes,
      showTapGateway: source.showTapGateway,
      showHyperPayGateway: source.showHyperPayGateway,
      showMyFatoorahGateway: source.showMyFatoorahGateway,
      codEnabled: params.marketCode === "GLOBAL" ? false : source.codEnabled,
      footerTaglineEn: null,
      footerTaglineAr: null,
      publicContactEmail: null,
      inquiryNotifyEmail: null,
    },
  });
}

/** Empty/placeholder issuer if missing — admin fills annex in wizard. */
async function ensureInvoiceIssuer(params: {
  marketId: string;
  marketCode: string;
  defaultCurrency: string;
  geoCountryCodes: string[];
  sourceMarketId: string;
}) {
  const existing = await prisma.marketInvoiceIssuer.findUnique({
    where: { marketId: params.marketId },
    select: { id: true },
  });
  if (existing) return;

  const source = await prisma.marketInvoiceIssuer.findUnique({
    where: { marketId: params.sourceMarketId },
  });
  const geo =
    params.geoCountryCodes[0]?.toUpperCase() ??
    (params.marketCode.length === 2 ? params.marketCode : "OM");

  await prisma.marketInvoiceIssuer.create({
    data: {
      marketId: params.marketId,
      code: `${params.marketCode}-DRAFT`,
      legalNameEn: "Pending legal name",
      legalNameAr: "بانتظار الاسم القانوني",
      commercialRegistration: null,
      unifiedNumber: null,
      addressLine1: "Pending address",
      addressLine2: null,
      city: "Pending",
      postalCode: null,
      countryCode: geo.length === 2 ? geo : "OM",
      phone: null,
      email: null,
      consumerProtectionAuthorityEn: source?.consumerProtectionAuthorityEn ?? null,
      consumerProtectionAuthorityAr: source?.consumerProtectionAuthorityAr ?? null,
      vatRegistered: false,
      vatTrn: null,
      vatPercent: 0,
      currency: params.defaultCurrency,
    },
  });
}

async function ensureLegalPolicyVersions(params: {
  marketId: string;
  sourceMarketId: string;
}) {
  const sourceRows = await prisma.legalPolicyVersion.findMany({
    where: { marketId: params.sourceMarketId, isCurrent: true },
  });
  const byType = new Map(sourceRows.map((r) => [r.documentType, r]));

  for (const documentType of LEGAL_DOCUMENT_TYPES) {
    const existing = await prisma.legalPolicyVersion.findFirst({
      where: {
        marketId: params.marketId,
        documentType,
        version: DEFAULT_LEGAL_POLICY_VERSION,
      },
      select: { id: true },
    });
    if (existing) continue;

    const source = byType.get(documentType);
    const titles = LEGAL_DOCUMENT_TITLES[documentType];
    await prisma.legalPolicyVersion.create({
      data: {
        marketId: params.marketId,
        documentType,
        version: DEFAULT_LEGAL_POLICY_VERSION,
        titleEn: source?.titleEn ?? titles.en,
        titleAr: source?.titleAr ?? titles.ar,
        bodyEn: source?.bodyEn ?? null,
        bodyAr: source?.bodyAr ?? null,
        publishedAt: null,
        isCurrent: true,
      },
    });
  }
}

async function ensureRefundFeeRules(marketId: string) {
  for (const cause of REFUND_FEE_CAUSES) {
    await prisma.refundFeeRule.upsert({
      where: { marketId_cause: { marketId, cause } },
      create: {
        marketId,
        cause,
        payer: DEFAULT_REFUND_FEE_PAYERS[cause],
      },
      update: {},
    });
  }
}

async function ensureInvoicingMatrix(_marketId: string) {
  const markets = await prisma.market.findMany({
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  for (const seller of markets) {
    for (const buyer of markets) {
      const same = seller.id === buyer.id;
      await prisma.marketInvoicingRule.upsert({
        where: {
          sellerMarketId_buyerMarketId: {
            sellerMarketId: seller.id,
            buyerMarketId: buyer.id,
          },
        },
        create: {
          sellerMarketId: seller.id,
          buyerMarketId: buyer.id,
          invoicingParty: same ? "MERCHANT" : "PLATFORM",
          commissionRate: same ? 0.05 : 0.1,
        },
        update: {},
      });
    }
  }
}

async function ensureShippingRates(params: {
  marketId: string;
  defaultCurrency: string;
  sourceMarketId: string;
}) {
  const count = await prisma.shippingRate.count({ where: { marketId: params.marketId } });
  if (count > 0) return;

  const sourceRates = await prisma.shippingRate.findMany({
    where: { marketId: params.sourceMarketId },
  });
  if (sourceRates.length === 0) return;

  await prisma.shippingRate.createMany({
    data: sourceRates.map((rate) => ({
      marketId: params.marketId,
      code: rate.code,
      packageType: rate.packageType,
      vandsoqMode: rate.vandsoqMode,
      amount: rate.amount,
      currency: params.defaultCurrency,
      perUnit: rate.perUnit,
      isActive: rate.isActive,
    })),
    skipDuplicates: true,
  });
}

/**
 * Provision / refresh the legal+commercial pack for a market by cloning from OM (default).
 * Works for known and DB-created market codes.
 */
export async function provisionMarketPack(params: {
  marketCode: string;
  cloneFrom?: MarketCode;
}): Promise<{ marketId: string; cloneFrom: MarketCode }> {
  const cloneFrom = params.cloneFrom ?? DEFAULT_CLONE_SOURCE;
  const target = await resolveMarketRow(params.marketCode);

  const sourceCode: MarketCode =
    isMarketCode(cloneFrom) && cloneFrom !== target.code ? cloneFrom : DEFAULT_CLONE_SOURCE;
  const source = await resolveMarketRow(sourceCode);

  await ensurePlatformConfig({
    marketId: target.id,
    marketCode: target.code,
    sourceMarketId: source.id,
  });
  await ensureInvoiceIssuer({
    marketId: target.id,
    marketCode: target.code,
    defaultCurrency: target.defaultCurrency,
    geoCountryCodes: target.geoCountryCodes,
    sourceMarketId: source.id,
  });
  await ensureLegalPolicyVersions({
    marketId: target.id,
    sourceMarketId: source.id,
  });
  await ensureRefundFeeRules(target.id);
  await ensureInvoicingMatrix(target.id);
  await ensureShippingRates({
    marketId: target.id,
    defaultCurrency: target.defaultCurrency,
    sourceMarketId: source.id,
  });

  await prisma.market.update({
    where: { id: target.id },
    data: { cloneSourceCode: sourceCode },
  });

  return { marketId: target.id, cloneFrom: sourceCode };
}

export async function publishCurrentLegalPolicies(marketId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.legalPolicyVersion.updateMany({
    where: {
      marketId,
      isCurrent: true,
      publishedAt: null,
      documentType: {
        in: ["ABOUT", "TERMS", "PRIVACY", "RETURNS", "SHIPPING", "PRICING_PAYMENT"],
      },
    },
    data: { publishedAt: now },
  });
  return result.count;
}

/** @deprecated use resolveMarketRow via provision — kept for MARKET_IDS callers */
export function knownMarketIdOrNull(code: string): string | null {
  if (isSeedMarketCode(code)) return MARKET_IDS[code];
  return null;
}
