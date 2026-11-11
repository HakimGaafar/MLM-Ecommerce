import {
  getMarketAnnexForPublic,
  getPublicLegalPageMeta,
} from "@mlm/domain";
import { LEGAL_DOCUMENT_TITLES, type LegalDocumentType } from "@mlm/shared";
import { toMarketAnnexView } from "./annex";
import { renderBundledPolicyDocumentWithAnnex } from "./content";
import { publicLegalSlugToDocumentType } from "./slugs";
import type { PolicyDocument, PublicLegalLocale, PublicLegalSlug } from "./types";

export type LoadedPublicLegalPage = {
  slug: PublicLegalSlug;
  documentType: LegalDocumentType;
  locale: PublicLegalLocale;
  title: string;
  document: PolicyDocument;
  version: string;
  publishedAt: string | null;
  isPublished: boolean;
  marketCode: string;
  annexEmail: string;
  annexPhone: string;
};

export async function loadPublicLegalPage(params: {
  slug: PublicLegalSlug;
  locale: PublicLegalLocale;
  marketId: string;
  marketCode: string;
}): Promise<LoadedPublicLegalPage | null> {
  const documentType = publicLegalSlugToDocumentType(params.slug);
  const annex = await getMarketAnnexForPublic(params.marketId);
  if (!annex) return null;

  // Closed markets must not expose public policy/Tap URLs (About still allowed via redirect to active market).
  const tapSlugs = new Set([
    "terms",
    "privacy",
    "returns-policy",
    "shipping-policy",
    "pricing-payment",
  ]);
  if (tapSlugs.has(params.slug) && !annex.isActive) {
    return null;
  }

  const document = renderBundledPolicyDocumentWithAnnex(
    documentType,
    params.locale,
    toMarketAnnexView(annex),
  );
  if (!document) return null;

  const meta = await getPublicLegalPageMeta(params.marketId, documentType);
  const titles = LEGAL_DOCUMENT_TITLES[documentType];
  const title =
    params.locale === "ar"
      ? meta?.titleAr || titles.ar
      : meta?.titleEn || titles.en;

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
    annexEmail: annex.issuer?.email ?? "",
    annexPhone: annex.issuer?.phone ?? "",
  };
}
