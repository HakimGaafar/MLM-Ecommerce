import { z } from "zod";

export const CheckoutCouponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric (dashes/underscores allowed).")
  .transform((v) => v.toUpperCase());

export const CheckoutCouponCodesSchema = z
  .array(CheckoutCouponCodeSchema)
  .min(1)
  .max(5)
  .transform((codes) => {
    // Dedupe while preserving order (important for stable quotes and usage consumption).
    const seen = new Set<string>();
    return codes.filter((c) => {
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  });

export const CheckoutCompanySchema = z
  .object({
    buyingForCompany: z.boolean().optional(),
    companyName: z.string().trim().max(200).optional().nullable(),
    companyTaxId: z.string().trim().max(64).optional().nullable(),
    companyCrNumber: z.string().trim().max(64).optional().nullable(),
    companyHqAddressLine1: z.string().trim().max(200).optional().nullable(),
    companyHqCity: z.string().trim().max(100).optional().nullable(),
    companyHqCountryCode: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.buyingForCompany) return;
    if (!value.companyName?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Company name is required when buying for a company.",
        path: ["companyName"],
      });
    }
  });

export const CheckoutPostSchema = z
  .object({
    paymentMethod: z.enum(["COD", "ONLINE_CARD"]).optional(),
    idempotencyKey: z.string().max(120).optional(),
    shippingAddressId: z.string().trim().min(1).optional(),
    couponCode: CheckoutCouponCodeSchema.optional(),
    couponCodes: CheckoutCouponCodesSchema.optional(),
    useWalletBalance: z.boolean().optional(),
    /** Accept FX / transfer / customs risk (cross-market settlement). */
    settlementRiskAccepted: z.boolean().optional(),
  })
  .merge(CheckoutCompanySchema);

export type CheckoutPostInput = z.infer<typeof CheckoutPostSchema>;
