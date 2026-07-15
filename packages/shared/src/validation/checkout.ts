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

export const CheckoutPostSchema = z.object({
  paymentMethod: z.enum(["COD", "ONLINE_CARD"]).optional(),
  idempotencyKey: z.string().max(120).optional(),
  shippingAddressId: z.string().trim().min(1).optional(),
  couponCode: CheckoutCouponCodeSchema.optional(),
  couponCodes: CheckoutCouponCodesSchema.optional(),
  useWalletBalance: z.boolean().optional(),
});

export type CheckoutPostInput = z.infer<typeof CheckoutPostSchema>;
