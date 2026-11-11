import type { LegalDocumentType } from "@mlm/shared";
import type { PublicLegalSlug } from "./types";

export const PUBLIC_LEGAL_SLUGS = [
  "about",
  "terms",
  "privacy",
  "returns-policy",
  "shipping-policy",
  "pricing-payment",
  "cashback-referral",
] as const satisfies readonly PublicLegalSlug[];

const SLUG_TO_DOCUMENT_TYPE: Record<PublicLegalSlug, LegalDocumentType> = {
  about: "ABOUT",
  terms: "TERMS",
  privacy: "PRIVACY",
  "returns-policy": "RETURNS",
  "shipping-policy": "SHIPPING",
  "pricing-payment": "PRICING_PAYMENT",
  "cashback-referral": "CASHBACK_REFERRAL",
};

const PUBLIC_DOCUMENT_TYPES = [
  "ABOUT",
  "TERMS",
  "PRIVACY",
  "RETURNS",
  "SHIPPING",
  "PRICING_PAYMENT",
  "CASHBACK_REFERRAL",
] as const satisfies readonly LegalDocumentType[];

const DOCUMENT_TYPE_TO_SLUG = {
  ABOUT: "about",
  TERMS: "terms",
  PRIVACY: "privacy",
  RETURNS: "returns-policy",
  SHIPPING: "shipping-policy",
  PRICING_PAYMENT: "pricing-payment",
  CASHBACK_REFERRAL: "cashback-referral",
} as const satisfies Record<(typeof PUBLIC_DOCUMENT_TYPES)[number], PublicLegalSlug>;

export function publicLegalSlugToDocumentType(slug: PublicLegalSlug): LegalDocumentType {
  return SLUG_TO_DOCUMENT_TYPE[slug];
}

export function documentTypeToPublicLegalSlug(
  documentType: LegalDocumentType,
): PublicLegalSlug | null {
  if ((PUBLIC_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    return DOCUMENT_TYPE_TO_SLUG[documentType as keyof typeof DOCUMENT_TYPE_TO_SLUG];
  }
  return null;
}

export function isPublicLegalSlug(value: string): value is PublicLegalSlug {
  return (PUBLIC_LEGAL_SLUGS as readonly string[]).includes(value);
}
