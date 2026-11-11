import { getMarketAnnexForPublic, getPublicLegalPageMeta } from "@mlm/domain";
import { LEGAL_DOCUMENT_TITLES, type LegalDocumentType } from "@mlm/shared";
import { toMarketAnnexView } from "./annex";
import { renderBundledPolicyDocumentWithAnnex } from "./content";
import type { PolicyDocument, PublicLegalLocale } from "./types";

export type MerchantPolicySlug =
  | "cooperation"
  | "operational"
  | "commission"
  | "data-confirmation";

export const MERCHANT_POLICY_SLUG_MAP: Record<MerchantPolicySlug, LegalDocumentType> = {
  cooperation: "MERCHANT_COOPERATION",
  operational: "MERCHANT_OPERATIONAL",
  commission: "MERCHANT_COMMISSION",
  "data-confirmation": "MERCHANT_DATA_CONFIRMATION",
};

export type LoadedMerchantLegalPage = {
  slug: MerchantPolicySlug;
  documentType: LegalDocumentType;
  locale: PublicLegalLocale;
  title: string;
  document: PolicyDocument;
  version: string;
  publishedAt: string | null;
  isPublished: boolean;
  marketCode: string;
};

export async function loadMerchantLegalPage(params: {
  slug: MerchantPolicySlug;
  locale: PublicLegalLocale;
  marketId: string;
  marketCode: string;
}): Promise<LoadedMerchantLegalPage | null> {
  const documentType = MERCHANT_POLICY_SLUG_MAP[params.slug];
  const annex = await getMarketAnnexForPublic(params.marketId);
  if (!annex) return null;

  const document = renderBundledPolicyDocumentWithAnnex(
    documentType,
    params.locale,
    toMarketAnnexView(annex),
  );
  if (!document) return null;

  const meta = await getPublicLegalPageMeta(params.marketId, documentType);
  const titles = LEGAL_DOCUMENT_TITLES[documentType];
  const title =
    params.locale === "ar" ? meta?.titleAr || titles.ar : meta?.titleEn || titles.en;

  return {
    slug: params.slug,
    documentType,
    locale: params.locale,
    title,
    document,
    version: meta?.version ?? "1.0",
    publishedAt: meta?.publishedAt ?? null,
    isPublished: meta?.isPublished ?? false,
    marketCode: params.marketCode,
  };
}
