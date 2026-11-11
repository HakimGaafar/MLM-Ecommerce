import { Prisma, prisma } from "@mlm/db";
import {
  DEFAULT_LEGAL_POLICY_VERSION,
  DEFAULT_REFUND_FEE_PAYERS,
  LEGAL_DOCUMENT_TITLES,
  REFUND_FEE_CAUSES,
  isMarketCodeFormat,
  type AdminLegalPolicyVersionUpsertInput,
  type AdminMarketAnnexUpdateInput,
  type AdminMarketInvoicingRuleUpsertInput,
  type AdminRefundFeeRuleUpsertInput,
  type InvoicingParty,
  type LegalDocumentType,
  type RefundFeeCause,
  type RefundFeePayer,
} from "@mlm/shared";
import { resolveMarketIdByCode } from "../markets/resolve-market-id";

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type MarketAnnexDto = {
  marketId: string;
  marketCode: string;
  isActive: boolean;
  defaultCurrency: string;
  paymentCurrencies: string[];
  issuer: {
    code: string;
    legalNameEn: string;
    legalNameAr: string;
    commercialRegistration: string | null;
    unifiedNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string | null;
    countryCode: string;
    phone: string | null;
    email: string | null;
    consumerProtectionAuthorityEn: string | null;
    consumerProtectionAuthorityAr: string | null;
    vatRegistered: boolean;
    vatTrn: string | null;
    vatPercent: number;
    currency: string;
  } | null;
};

export type LegalPolicyVersionDto = {
  id: string;
  marketId: string;
  marketCode: string;
  documentType: LegalDocumentType;
  version: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MarketInvoicingRuleDto = {
  id: string;
  sellerMarketCode: string;
  buyerMarketCode: string;
  invoicingParty: InvoicingParty;
  commissionPercent: number | null;
};

export type RefundFeeRuleDto = {
  marketCode: string;
  cause: RefundFeeCause;
  payer: RefundFeePayer;
};

async function requireMarket(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!isMarketCodeFormat(normalized)) {
    throw new Error("MARKET_NOT_FOUND");
  }
  const market = await prisma.market.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      isActive: true,
      defaultCurrency: true,
      paymentCurrencies: true,
    },
  });
  if (!market) {
    throw new Error("MARKET_NOT_FOUND");
  }
  return market;
}

export async function getAdminMarketAnnex(marketCode: string): Promise<MarketAnnexDto> {
  const market = await requireMarket(marketCode);
  const issuer = await prisma.marketInvoiceIssuer.findUnique({
    where: { marketId: market.id },
  });
  return {
    marketId: market.id,
    marketCode: market.code,
    isActive: market.isActive,
    defaultCurrency: market.defaultCurrency,
    paymentCurrencies: market.paymentCurrencies,
    issuer: issuer
      ? {
          code: issuer.code,
          legalNameEn: issuer.legalNameEn,
          legalNameAr: issuer.legalNameAr,
          commercialRegistration: issuer.commercialRegistration,
          unifiedNumber: issuer.unifiedNumber,
          addressLine1: issuer.addressLine1,
          addressLine2: issuer.addressLine2,
          city: issuer.city,
          postalCode: issuer.postalCode,
          countryCode: issuer.countryCode,
          phone: issuer.phone,
          email: issuer.email,
          consumerProtectionAuthorityEn: issuer.consumerProtectionAuthorityEn,
          consumerProtectionAuthorityAr: issuer.consumerProtectionAuthorityAr,
          vatRegistered: issuer.vatRegistered,
          vatTrn: issuer.vatTrn,
          vatPercent: Number(issuer.vatPercent),
          currency: issuer.currency,
        }
      : null,
  };
}

export async function updateAdminMarketAnnex(params: {
  marketCode: string;
  input: AdminMarketAnnexUpdateInput;
}): Promise<MarketAnnexDto> {
  const market = await requireMarket(params.marketCode);
  const input = params.input;

  if (input.paymentCurrencies || input.defaultCurrency) {
    const paymentCurrencies = input.paymentCurrencies ?? market.paymentCurrencies;
    const defaultCurrency = input.defaultCurrency ?? market.defaultCurrency;
    if (!paymentCurrencies.includes(defaultCurrency)) {
      throw new Error("DEFAULT_CURRENCY_NOT_IN_PAYMENT_CURRENCIES");
    }
    await prisma.market.update({
      where: { id: market.id },
      data: {
        ...(input.paymentCurrencies ? { paymentCurrencies: input.paymentCurrencies } : {}),
        ...(input.defaultCurrency ? { defaultCurrency: input.defaultCurrency } : {}),
      },
    });
  }

  const existing = await prisma.marketInvoiceIssuer.findUnique({
    where: { marketId: market.id },
  });
  if (!existing) {
    throw new Error("ISSUER_NOT_FOUND");
  }

  await prisma.marketInvoiceIssuer.update({
    where: { marketId: market.id },
    data: {
      ...(input.legalNameEn !== undefined ? { legalNameEn: input.legalNameEn } : {}),
      ...(input.legalNameAr !== undefined ? { legalNameAr: input.legalNameAr } : {}),
      ...(input.commercialRegistration !== undefined
        ? { commercialRegistration: normalizeOptionalText(input.commercialRegistration) }
        : {}),
      ...(input.unifiedNumber !== undefined
        ? { unifiedNumber: normalizeOptionalText(input.unifiedNumber) }
        : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined
        ? { addressLine2: normalizeOptionalText(input.addressLine2) }
        : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.postalCode !== undefined
        ? { postalCode: normalizeOptionalText(input.postalCode) }
        : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      ...(input.phone !== undefined ? { phone: normalizeOptionalText(input.phone) } : {}),
      ...(input.email !== undefined ? { email: normalizeOptionalText(input.email) } : {}),
      ...(input.consumerProtectionAuthorityEn !== undefined
        ? {
            consumerProtectionAuthorityEn: normalizeOptionalText(
              input.consumerProtectionAuthorityEn,
            ),
          }
        : {}),
      ...(input.consumerProtectionAuthorityAr !== undefined
        ? {
            consumerProtectionAuthorityAr: normalizeOptionalText(
              input.consumerProtectionAuthorityAr,
            ),
          }
        : {}),
      ...(input.vatRegistered !== undefined ? { vatRegistered: input.vatRegistered } : {}),
      ...(input.vatTrn !== undefined ? { vatTrn: normalizeOptionalText(input.vatTrn) } : {}),
      ...(input.vatPercent !== undefined
        ? { vatPercent: new Prisma.Decimal(input.vatPercent) }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    },
  });

  return getAdminMarketAnnex(params.marketCode);
}

function mapPolicyRow(row: {
  id: string;
  marketId: string;
  documentType: LegalDocumentType;
  version: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  publishedAt: Date | null;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
  market: { code: string };
}): LegalPolicyVersionDto {
  if (!isMarketCodeFormat(row.market.code)) {
    throw new Error("MARKET_NOT_FOUND");
  }
  return {
    id: row.id,
    marketId: row.marketId,
    marketCode: row.market.code,
    documentType: row.documentType,
    version: row.version,
    titleEn: row.titleEn,
    titleAr: row.titleAr,
    bodyEn: row.bodyEn,
    bodyAr: row.bodyAr,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminLegalPolicyVersions(params: {
  marketCode: string;
  documentType?: LegalDocumentType;
}): Promise<LegalPolicyVersionDto[]> {
  const market = await requireMarket(params.marketCode);
  const rows = await prisma.legalPolicyVersion.findMany({
    where: {
      marketId: market.id,
      ...(params.documentType ? { documentType: params.documentType } : {}),
    },
    include: { market: { select: { code: true } } },
    orderBy: [{ documentType: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => mapPolicyRow(row as Parameters<typeof mapPolicyRow>[0]));
}

export async function upsertAdminLegalPolicyVersion(params: {
  marketCode: string;
  input: AdminLegalPolicyVersionUpsertInput;
}): Promise<LegalPolicyVersionDto> {
  const market = await requireMarket(params.marketCode);
  const version = params.input.version?.trim() || DEFAULT_LEGAL_POLICY_VERSION;
  const titles = LEGAL_DOCUMENT_TITLES[params.input.documentType];
  const publish = params.input.publish === true;
  const setCurrent = params.input.setCurrent !== false;

  if (setCurrent) {
    await prisma.legalPolicyVersion.updateMany({
      where: {
        marketId: market.id,
        documentType: params.input.documentType,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });
  }

  const row = await prisma.legalPolicyVersion.upsert({
    where: {
      marketId_documentType_version: {
        marketId: market.id,
        documentType: params.input.documentType,
        version,
      },
    },
    create: {
      marketId: market.id,
      documentType: params.input.documentType,
      version,
      titleEn: params.input.titleEn?.trim() || titles.en,
      titleAr: params.input.titleAr?.trim() || titles.ar,
      bodyEn: params.input.bodyEn ?? null,
      bodyAr: params.input.bodyAr ?? null,
      publishedAt: publish ? new Date() : null,
      isCurrent: setCurrent,
    },
    update: {
      ...(params.input.titleEn !== undefined
        ? { titleEn: params.input.titleEn.trim() || titles.en }
        : {}),
      ...(params.input.titleAr !== undefined
        ? { titleAr: params.input.titleAr.trim() || titles.ar }
        : {}),
      ...(params.input.bodyEn !== undefined ? { bodyEn: params.input.bodyEn } : {}),
      ...(params.input.bodyAr !== undefined ? { bodyAr: params.input.bodyAr } : {}),
      ...(publish ? { publishedAt: new Date() } : {}),
      ...(setCurrent ? { isCurrent: true } : {}),
    },
    include: { market: { select: { code: true } } },
  });

  return mapPolicyRow(row as Parameters<typeof mapPolicyRow>[0]);
}

export async function listAdminMarketInvoicingRules(): Promise<MarketInvoicingRuleDto[]> {
  const rows = await prisma.marketInvoicingRule.findMany({
    include: {
      sellerMarket: { select: { code: true } },
      buyerMarket: { select: { code: true } },
    },
    orderBy: [{ sellerMarketId: "asc" }, { buyerMarketId: "asc" }],
  });
  return rows
    .filter(
      (row) =>
        isMarketCodeFormat(row.sellerMarket.code) && isMarketCodeFormat(row.buyerMarket.code),
    )
    .map((row) => ({
      id: row.id,
      sellerMarketCode: row.sellerMarket.code,
      buyerMarketCode: row.buyerMarket.code,
      invoicingParty: row.invoicingParty as InvoicingParty,
      commissionPercent:
        row.commissionRate != null ? Math.round(Number(row.commissionRate) * 1000) / 10 : null,
    }));
}

export async function upsertAdminMarketInvoicingRule(
  input: AdminMarketInvoicingRuleUpsertInput,
): Promise<MarketInvoicingRuleDto> {
  if (
    !isMarketCodeFormat(input.sellerMarketCode) ||
    !isMarketCodeFormat(input.buyerMarketCode)
  ) {
    throw new Error("MARKET_NOT_FOUND");
  }
  const sellerMarketId = await resolveMarketIdByCode(input.sellerMarketCode);
  const buyerMarketId = await resolveMarketIdByCode(input.buyerMarketCode);
  const commissionRate =
    input.commissionPercent == null
      ? null
      : new Prisma.Decimal(Math.round(input.commissionPercent * 10_000) / 1_000_000);

  const row = await prisma.marketInvoicingRule.upsert({
    where: {
      sellerMarketId_buyerMarketId: { sellerMarketId, buyerMarketId },
    },
    create: {
      sellerMarketId,
      buyerMarketId,
      invoicingParty: input.invoicingParty,
      commissionRate,
    },
    update: {
      invoicingParty: input.invoicingParty,
      commissionRate,
    },
    include: {
      sellerMarket: { select: { code: true } },
      buyerMarket: { select: { code: true } },
    },
  });

  return {
    id: row.id,
    sellerMarketCode: row.sellerMarket.code,
    buyerMarketCode: row.buyerMarket.code,
    invoicingParty: row.invoicingParty as InvoicingParty,
    commissionPercent:
      row.commissionRate != null ? Math.round(Number(row.commissionRate) * 1000) / 10 : null,
  };
}

export async function listAdminRefundFeeRules(marketCode: string): Promise<RefundFeeRuleDto[]> {
  const market = await requireMarket(marketCode);
  const rows = await prisma.refundFeeRule.findMany({
    where: { marketId: market.id },
  });
  const byCause = new Map(rows.map((r) => [r.cause as RefundFeeCause, r.payer as RefundFeePayer]));
  return REFUND_FEE_CAUSES.map((cause) => ({
    marketCode: market.code,
    cause,
    payer: byCause.get(cause) ?? DEFAULT_REFUND_FEE_PAYERS[cause],
  }));
}

export async function upsertAdminRefundFeeRule(params: {
  marketCode: string;
  input: AdminRefundFeeRuleUpsertInput;
}): Promise<RefundFeeRuleDto> {
  const market = await requireMarket(params.marketCode);
  await prisma.refundFeeRule.upsert({
    where: {
      marketId_cause: { marketId: market.id, cause: params.input.cause },
    },
    create: {
      marketId: market.id,
      cause: params.input.cause,
      payer: params.input.payer,
    },
    update: { payer: params.input.payer },
  });
  return {
    marketCode: market.code,
    cause: params.input.cause,
    payer: params.input.payer,
  };
}

export async function bulkUpsertAdminRefundFeeRules(params: {
  marketCode: string;
  rules: AdminRefundFeeRuleUpsertInput[];
}): Promise<RefundFeeRuleDto[]> {
  for (const rule of params.rules) {
    await upsertAdminRefundFeeRule({ marketCode: params.marketCode, input: rule });
  }
  return listAdminRefundFeeRules(params.marketCode);
}

/** Resolve invoicing party for a seller×buyer market pair (defaults if row missing). */
export async function resolveInvoicingParty(params: {
  sellerMarketId: string;
  buyerMarketId: string;
}): Promise<{ invoicingParty: InvoicingParty; commissionRate: number | null }> {
  const row = await prisma.marketInvoicingRule.findUnique({
    where: {
      sellerMarketId_buyerMarketId: {
        sellerMarketId: params.sellerMarketId,
        buyerMarketId: params.buyerMarketId,
      },
    },
  });
  if (row) {
    return {
      invoicingParty: row.invoicingParty as InvoicingParty,
      commissionRate: row.commissionRate != null ? Number(row.commissionRate) : null,
    };
  }
  const same = params.sellerMarketId === params.buyerMarketId;
  return {
    invoicingParty: same ? "MERCHANT" : "PLATFORM",
    commissionRate: same ? 0.05 : 0.1,
  };
}

export async function resolveRefundFeePayer(params: {
  marketId: string;
  cause: RefundFeeCause;
}): Promise<RefundFeePayer> {
  const row = await prisma.refundFeeRule.findUnique({
    where: {
      marketId_cause: { marketId: params.marketId, cause: params.cause },
    },
  });
  return (row?.payer as RefundFeePayer | undefined) ?? DEFAULT_REFUND_FEE_PAYERS[params.cause];
}
