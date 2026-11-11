import { prisma } from "@mlm/db";
import type { LegalDocumentType } from "@mlm/shared";

export type PublicMarketAnnex = {
  marketId: string;
  code: string;
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

export type PublicLegalPageMeta = {
  version: string;
  publishedAt: string | null;
  titleEn: string;
  titleAr: string;
  isPublished: boolean;
};

export async function getMarketAnnexForPublic(marketId: string): Promise<PublicMarketAnnex | null> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      code: true,
      isActive: true,
      defaultCurrency: true,
      paymentCurrencies: true,
      invoiceIssuer: true,
    },
  });
  if (!market) return null;

  return {
    marketId: market.id,
    code: market.code,
    isActive: market.isActive,
    defaultCurrency: market.defaultCurrency,
    paymentCurrencies: market.paymentCurrencies,
    issuer: market.invoiceIssuer
      ? {
          code: market.invoiceIssuer.code,
          legalNameEn: market.invoiceIssuer.legalNameEn,
          legalNameAr: market.invoiceIssuer.legalNameAr,
          commercialRegistration: market.invoiceIssuer.commercialRegistration,
          unifiedNumber: market.invoiceIssuer.unifiedNumber,
          addressLine1: market.invoiceIssuer.addressLine1,
          addressLine2: market.invoiceIssuer.addressLine2,
          city: market.invoiceIssuer.city,
          postalCode: market.invoiceIssuer.postalCode,
          countryCode: market.invoiceIssuer.countryCode,
          phone: market.invoiceIssuer.phone,
          email: market.invoiceIssuer.email,
          consumerProtectionAuthorityEn: market.invoiceIssuer.consumerProtectionAuthorityEn,
          consumerProtectionAuthorityAr: market.invoiceIssuer.consumerProtectionAuthorityAr,
          vatRegistered: market.invoiceIssuer.vatRegistered,
          vatTrn: market.invoiceIssuer.vatTrn,
          vatPercent: Number(market.invoiceIssuer.vatPercent),
          currency: market.invoiceIssuer.currency,
        }
      : null,
  };
}

export async function getPublicLegalPageMeta(
  marketId: string,
  documentType: LegalDocumentType,
): Promise<PublicLegalPageMeta | null> {
  const row = await prisma.legalPolicyVersion.findFirst({
    where: {
      marketId,
      documentType,
      isCurrent: true,
    },
    select: {
      version: true,
      publishedAt: true,
      titleEn: true,
      titleAr: true,
    },
  });
  if (!row) return null;

  return {
    version: row.version,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    titleEn: row.titleEn,
    titleAr: row.titleAr,
    isPublished: Boolean(row.publishedAt),
  };
}
