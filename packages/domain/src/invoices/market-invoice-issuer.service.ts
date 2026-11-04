import { prisma } from "@mlm/db";
import { getPlatformInvoiceEntity, type PlatformInvoiceEntity } from "./platform-entity";

export type MarketIssuerDto = PlatformInvoiceEntity & {
  marketId: string;
  code: string;
  currency: string;
  vatPercent: number;
  vatRegistered: boolean;
};

/** Prefer MarketInvoiceIssuer row; fall back to env platform entity. */
export async function getMarketInvoiceIssuer(marketId: string): Promise<MarketIssuerDto> {
  const row = await prisma.marketInvoiceIssuer.findUnique({
    where: { marketId },
  });
  if (row) {
    const vatPercent = Number(row.vatPercent);
    return {
      marketId: row.marketId,
      code: row.code,
      legalName: row.legalNameEn,
      vatTrn: row.vatTrn,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      postalCode: row.postalCode ?? "",
      countryCode: row.countryCode,
      logoUrl: row.logoUrl,
      currency: row.currency,
      vatPercent,
      vatRegistered: row.vatRegistered,
    };
  }

  const fallback = getPlatformInvoiceEntity();
  return {
    marketId,
    code: "PLATFORM",
    ...fallback,
    postalCode: fallback.postalCode,
    currency: "SAR",
    vatPercent: 0,
    vatRegistered: Boolean(fallback.vatTrn),
  };
}
