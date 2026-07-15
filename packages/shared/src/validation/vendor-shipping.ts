import { z } from "zod";

const shippingMode = z.enum(["DIRECT", "INDIRECT"]);
const indirectFulfillment = z.enum(["FORSEIZ_STOCK", "ON_ORDER"]);

export const VendorShippingChangeRequestSchema = z
  .object({
    shippingMode: shippingMode,
    indirectFulfillment: indirectFulfillment.optional().nullable(),
    shippingFee: z.coerce.number().min(0).max(1_000_000),
    shippingNotes: z.string().trim().min(10).max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shippingMode === "INDIRECT" && !data.indirectFulfillment) {
      ctx.addIssue({
        code: "custom",
        message: "Indirect fulfillment type is required for indirect shipping.",
        path: ["indirectFulfillment"],
      });
    }
    if (data.shippingMode === "DIRECT" && data.indirectFulfillment) {
      ctx.addIssue({
        code: "custom",
        message: "Indirect fulfillment must be empty for direct shipping.",
        path: ["indirectFulfillment"],
      });
    }
  });

export type VendorShippingChangeRequestInput = z.infer<typeof VendorShippingChangeRequestSchema>;
