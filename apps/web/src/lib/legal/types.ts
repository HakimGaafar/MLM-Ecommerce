import type { LegalDocumentType } from "@mlm/shared";

export type PublicLegalLocale = "en" | "ar";

/** URL slug for public legal routes (Phase 2 pages). */
export type PublicLegalSlug =
  | "about"
  | "terms"
  | "privacy"
  | "returns-policy"
  | "shipping-policy"
  | "pricing-payment"
  | "cashback-referral";

export type PolicySection = {
  id: string;
  heading?: string;
  /** Body copy; may be empty when the section uses bullets only. */
  paragraphs?: string[];
  bullets?: string[];
};

/** Bundled policy body (placeholders not yet applied). */
export type PolicyDocument = {
  documentType: LegalDocumentType;
  locale: PublicLegalLocale;
  sections: PolicySection[];
};
