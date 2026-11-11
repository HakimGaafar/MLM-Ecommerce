import { z } from "zod";
import {
  CUSTOMER_CHECKOUT_DOCUMENT_TYPES,
  CUSTOMER_SIGNUP_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_TYPES,
  MERCHANT_REGISTRATION_DOCUMENT_TYPES,
} from "../legal-policy";

const documentTypeSchema = z.enum(LEGAL_DOCUMENT_TYPES);

export const ConsentAcceptanceSchema = z.object({
  documentType: documentTypeSchema,
  policyVersion: z.string().trim().min(1).max(32),
});

export const CustomerSignupConsentsSchema = z.object({
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});

export type CustomerSignupConsentsInput = z.infer<typeof CustomerSignupConsentsSchema>;

export const CustomerCheckoutConsentsSchema = z.object({
  acceptTerms: z.literal(true),
  acceptReturns: z.literal(true),
  acceptShipping: z.literal(true),
});

export type CustomerCheckoutConsentsInput = z.infer<typeof CustomerCheckoutConsentsSchema>;

export const MerchantRegistrationConsentsSchema = z.object({
  acceptedDocumentTypes: z
    .array(documentTypeSchema)
    .min(MERCHANT_REGISTRATION_DOCUMENT_TYPES.length)
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
});

export type MerchantRegistrationConsentsInput = z.infer<typeof MerchantRegistrationConsentsSchema>;

export function signupDocumentTypesFromFlags(
  input: CustomerSignupConsentsInput,
): Array<(typeof CUSTOMER_SIGNUP_DOCUMENT_TYPES)[number]> {
  void input;
  return [...CUSTOMER_SIGNUP_DOCUMENT_TYPES];
}

export function checkoutDocumentTypesFromFlags(
  input: CustomerCheckoutConsentsInput,
): Array<(typeof CUSTOMER_CHECKOUT_DOCUMENT_TYPES)[number]> {
  void input;
  return [...CUSTOMER_CHECKOUT_DOCUMENT_TYPES];
}
