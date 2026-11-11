import { z } from "zod";
import { LEGAL_DOCUMENT_TYPES, MERCHANT_REGISTRATION_DOCUMENT_TYPES } from "../legal-policy";
import { MerchantUsernameSchema } from "./merchant-username";
import { STORE_SLUG_REGEX } from "./seller-onboarding";

export const VendorOnboardingPageKeySchema = z.enum([
  "account",
  "personal",
  "legal",
  "store",
  "financial",
  "review",
]);

export type VendorOnboardingPageKey = z.infer<typeof VendorOnboardingPageKeySchema>;

export const VendorEntityTypeSchema = z.enum([
  "INDIVIDUAL",
  "COMPANY",
  "ESTABLISHMENT",
  "FREELANCE",
  "OTHER",
]);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Page 1 — account / representative basics (+ Turnstile token). */
export const VendorOnboardingAccountSchema = z
  .object({
    repNameEn: z.string().trim().min(2).max(120),
    repNameOther: optionalText(120),
    phone: z.string().trim().min(6).max(32),
    email: z.string().trim().toLowerCase().email(),
    username: MerchantUsernameSchema,
    password: z.string().min(10).max(128),
    confirmPassword: z.string().min(10).max(128),
    storeName: z.string().trim().min(2).max(120),
    shortBusinessNote: optionalText(500),
    acceptCommissionTerms: z.literal(true),
    /** Phase 3 — all nine merchant registration document types must be accepted. */
    acceptedDocumentTypes: z
      .array(z.enum(LEGAL_DOCUMENT_TYPES))
      .superRefine((types, ctx) => {
        const set = new Set(types);
        for (const required of MERCHANT_REGISTRATION_DOCUMENT_TYPES) {
          if (!set.has(required)) {
            ctx.addIssue({
              code: "custom",
              message: `Missing consent: ${required}`,
            });
          }
        }
      }),
    turnstileToken: z.string().trim().min(1).optional(),
    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,24}$/)
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Page 2 — personal KYC (uploads handled separately). */
export const VendorOnboardingPersonalSchema = z.object({
  fullNameEn: z.string().trim().min(2).max(120),
  fullNameOther: optionalText(120),
  phone: z.string().trim().min(6).max(32),
  email: z.string().trim().toLowerCase().email(),
  identityDocumentKind: z.enum([
    "NATIONAL_ID",
    "PASSPORT",
    "RESIDENCY",
    "DRIVING_LICENSE",
    "TAX_ID",
    "OTHER",
  ]),
  documentNumber: z.string().trim().min(2).max(64),
  documentExpiresAt: z.string().trim().min(4).max(32).optional().or(z.literal("")),
  addressOptional: optionalText(500),
});

/** Page 3 — legal entity. */
export const VendorOnboardingLegalSchema = z.object({
  legalNameEn: z.string().trim().min(2).max(200),
  legalNameOther: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(6).max(32).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  entityType: VendorEntityTypeSchema,
  countryCode: z.string().trim().toUpperCase().length(2),
  region: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(200),
  landmark: optionalText(200),
  postalCode: z.string().trim().min(2).max(20),
  poBox: optionalText(64),
  googleMapsUrl: optionalText(500),
  additionalInfo: optionalText(1000),
});

/** Page 4 — store. */
export const VendorOnboardingStoreSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(STORE_SLUG_REGEX),
  storeName: z.string().trim().min(2).max(120),
  storeNameOther: optionalText(120),
  storeDescriptionEn: z.string().trim().min(10).max(5000),
  storeDescriptionOther: optionalText(5000),
});

/** Page 5 — financial. */
export const VendorOnboardingFinancialSchema = z.object({
  vatRegistered: z.boolean(),
  vatTrn: optionalText(32),
  vatPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  hasBankAccount: z.boolean(),
  payoutIban: optionalText(34),
  payoutBankName: optionalText(120),
  payoutAccountHolder: optionalText(200),
  acceptCrossMarketTerms: z.boolean().optional(),
});

export const VendorOnboardingSubmitReviewSchema = z.object({
  confirmComplete: z.literal(true),
});

export type VendorOnboardingAccountInput = z.infer<typeof VendorOnboardingAccountSchema>;
export type VendorOnboardingPersonalInput = z.infer<typeof VendorOnboardingPersonalSchema>;
export type VendorOnboardingLegalInput = z.infer<typeof VendorOnboardingLegalSchema>;
export type VendorOnboardingStoreInput = z.infer<typeof VendorOnboardingStoreSchema>;
export type VendorOnboardingFinancialInput = z.infer<typeof VendorOnboardingFinancialSchema>;
