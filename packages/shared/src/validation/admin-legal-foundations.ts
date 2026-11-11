import { z } from "zod";
import {
  INVOICING_PARTIES,
  LEGAL_DOCUMENT_TYPES,
  REFUND_FEE_CAUSES,
  REFUND_FEE_PAYERS,
} from "../legal-policy";

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code");

export const AdminMarketAnnexUpdateSchema = z.object({
  legalNameEn: z.string().trim().min(2).max(200).optional(),
  legalNameAr: z.string().trim().min(2).max(200).optional(),
  commercialRegistration: z.string().trim().max(64).nullable().optional(),
  unifiedNumber: z.string().trim().max(64).nullable().optional(),
  addressLine1: z.string().trim().min(2).max(200).optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100).optional(),
  postalCode: z.string().trim().max(32).nullable().optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.union([z.string().email().max(254), z.literal(""), z.null()]).optional(),
  consumerProtectionAuthorityEn: z.string().trim().max(300).nullable().optional(),
  consumerProtectionAuthorityAr: z.string().trim().max(300).nullable().optional(),
  vatRegistered: z.boolean().optional(),
  vatTrn: z.string().trim().max(64).nullable().optional(),
  vatPercent: z.coerce.number().min(0).max(100).optional(),
  currency: currencyCode.optional(),
  paymentCurrencies: z.array(currencyCode).min(1).max(8).optional(),
  defaultCurrency: currencyCode.optional(),
});

export type AdminMarketAnnexUpdateInput = z.infer<typeof AdminMarketAnnexUpdateSchema>;

export const AdminLegalPolicyVersionUpsertSchema = z.object({
  documentType: z.enum(LEGAL_DOCUMENT_TYPES),
  version: z.string().trim().min(1).max(32).default("1.0"),
  titleEn: z.string().trim().min(2).max(200).optional(),
  titleAr: z.string().trim().min(2).max(200).optional(),
  bodyEn: z.string().max(200_000).nullable().optional(),
  bodyAr: z.string().max(200_000).nullable().optional(),
  publish: z.boolean().optional(),
  setCurrent: z.boolean().optional(),
});

export type AdminLegalPolicyVersionUpsertInput = z.infer<typeof AdminLegalPolicyVersionUpsertSchema>;

export const AdminMarketInvoicingRuleUpsertSchema = z.object({
  sellerMarketCode: z.string().trim().toUpperCase().min(2).max(16),
  buyerMarketCode: z.string().trim().toUpperCase().min(2).max(16),
  invoicingParty: z.enum(INVOICING_PARTIES),
  commissionPercent: z.coerce.number().min(0).max(100).nullable().optional(),
});

export type AdminMarketInvoicingRuleUpsertInput = z.infer<typeof AdminMarketInvoicingRuleUpsertSchema>;

export const AdminRefundFeeRuleUpsertSchema = z.object({
  cause: z.enum(REFUND_FEE_CAUSES),
  payer: z.enum(REFUND_FEE_PAYERS),
});

export type AdminRefundFeeRuleUpsertInput = z.infer<typeof AdminRefundFeeRuleUpsertSchema>;

export const AdminRefundFeeRulesBulkSchema = z.object({
  rules: z.array(AdminRefundFeeRuleUpsertSchema).min(1).max(REFUND_FEE_CAUSES.length),
});

export type AdminRefundFeeRulesBulkInput = z.infer<typeof AdminRefundFeeRulesBulkSchema>;
