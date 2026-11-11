import type { LegalDocumentType } from "@mlm/shared";
import { applyAnnexPlaceholders, type MarketAnnexView } from "../annex";
import type { PolicyDocument, PublicLegalLocale } from "../types";
import { aboutPolicy } from "./about";
import { cashbackReferralPolicy } from "./cashback-referral";
import { pricingPaymentPolicy } from "./pricing-payment";
import { privacyPolicy } from "./privacy";
import { returnsPolicy } from "./returns";
import { shippingPolicy } from "./shipping";
import { termsPolicy } from "./terms";

const BUNDLED_BY_TYPE: Record<
  LegalDocumentType,
  { en: PolicyDocument; ar: PolicyDocument } | undefined
> = {
  ABOUT: aboutPolicy,
  TERMS: termsPolicy,
  PRIVACY: privacyPolicy,
  RETURNS: returnsPolicy,
  SHIPPING: shippingPolicy,
  PRICING_PAYMENT: pricingPaymentPolicy,
  CASHBACK_REFERRAL: cashbackReferralPolicy,
  MERCHANT_COOPERATION: undefined,
  MERCHANT_OPERATIONAL: undefined,
  MERCHANT_COMMISSION: undefined,
  MERCHANT_DATA_CONFIRMATION: undefined,
};

export function getBundledPolicyDocument(
  documentType: LegalDocumentType,
  locale: PublicLegalLocale,
): PolicyDocument | null {
  const bundle = BUNDLED_BY_TYPE[documentType];
  if (!bundle) return null;
  return bundle[locale];
}

function injectSection(
  section: PolicyDocument["sections"][number],
  annex: MarketAnnexView,
  locale: PublicLegalLocale,
): PolicyDocument["sections"][number] {
  return {
    ...section,
    heading: section.heading
      ? applyAnnexPlaceholders(section.heading, annex, locale)
      : undefined,
    paragraphs: section.paragraphs?.map((p) => applyAnnexPlaceholders(p, annex, locale)),
    bullets: section.bullets?.map((b) => applyAnnexPlaceholders(b, annex, locale)),
  };
}

/** Apply market annex placeholders to every string in a bundled policy document. */
export function renderPolicyDocumentWithAnnex(
  document: PolicyDocument,
  annex: MarketAnnexView,
  locale: PublicLegalLocale = document.locale,
): PolicyDocument {
  return {
    ...document,
    locale,
    sections: document.sections.map((section) => injectSection(section, annex, locale)),
  };
}

export function renderBundledPolicyDocumentWithAnnex(
  documentType: LegalDocumentType,
  locale: PublicLegalLocale,
  annex: MarketAnnexView,
): PolicyDocument | null {
  const bundled = getBundledPolicyDocument(documentType, locale);
  if (!bundled) return null;
  return renderPolicyDocumentWithAnnex(bundled, annex, locale);
}
