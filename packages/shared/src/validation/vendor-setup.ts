import { z } from "zod";

const urlOptional = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v));

export const VendorSetupBrandingSchema = z.object({
  logoUrl: urlOptional,
  bannerUrl: urlOptional,
});

const shippingMode = z.enum(["DIRECT", "INDIRECT"]);
const indirectFulfillment = z.enum(["FORSEIZ_STOCK", "ON_ORDER"]);

export const VendorSetupShippingSchema = z
  .object({
    shippingNotes: z.string().trim().min(10).max(2000),
    shippingMode: shippingMode.default("DIRECT"),
    indirectFulfillment: indirectFulfillment.optional().nullable(),
    /** Ignored for checkout pricing — platform rate list applies. Kept for profile approval workflow. */
    shippingFee: z.coerce.number().min(0).max(1_000_000).optional().default(0),
    deliveryCities: z
      .array(
        z.object({
          countryCode: z.string().trim().length(2).toUpperCase(),
          city: z.string().trim().min(2).max(120),
        }),
      )
      .max(100)
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.shippingMode === "INDIRECT" && !data.indirectFulfillment) {
      ctx.addIssue({
        code: "custom",
        message: "Select warehouse type for indirect shipping.",
        path: ["indirectFulfillment"],
      });
    }
    if (data.shippingMode === "DIRECT" && data.indirectFulfillment) {
      ctx.addIssue({
        code: "custom",
        message: "Warehouse type must be empty for direct shipping.",
        path: ["indirectFulfillment"],
      });
    }
    if (data.shippingMode === "DIRECT" && (data.deliveryCities?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one delivery city for direct shipping.",
        path: ["deliveryCities"],
      });
    }
  });

export const VendorSetupPayoutSchema = z.object({
  payoutAccountHolder: z.string().trim().min(2).max(200),
  payoutIban: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed.toUpperCase();
    },
    z
      .string()
      .min(15)
      .max(34)
      .regex(/^[A-Z0-9]+$/, "Invalid IBAN format")
      .optional(),
  ),
});

export type VendorSetupBrandingInput = z.infer<typeof VendorSetupBrandingSchema>;
export type VendorSetupShippingInput = z.infer<typeof VendorSetupShippingSchema>;
export type VendorSetupPayoutInput = z.infer<typeof VendorSetupPayoutSchema>;
