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
    shippingFee: z.coerce.number().min(0).max(1_000_000),
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
  });

export const VendorSetupPayoutSchema = z.object({
  payoutAccountHolder: z.string().trim().min(2).max(200),
  payoutIban: z
    .string()
    .trim()
    .min(15)
    .max(34)
    .regex(/^[A-Za-z0-9]+$/, "Invalid IBAN format"),
});

export type VendorSetupBrandingInput = z.infer<typeof VendorSetupBrandingSchema>;
export type VendorSetupShippingInput = z.infer<typeof VendorSetupShippingSchema>;
export type VendorSetupPayoutInput = z.infer<typeof VendorSetupPayoutSchema>;
