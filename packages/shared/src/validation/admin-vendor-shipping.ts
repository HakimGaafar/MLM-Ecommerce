import { z } from "zod";

const shippingMode = z.enum(["DIRECT", "INDIRECT"]);
const indirectFulfillment = z.enum(["FORSEIZ_STOCK", "ON_ORDER"]);

export const AdminVendorShippingSetSchema = z
  .object({
    shippingMode: shippingMode,
    indirectFulfillment: indirectFulfillment.optional().nullable(),
    shippingFee: z.coerce.number().min(0).max(1_000_000),
    shippingNotes: z.string().trim().max(2000).optional().nullable(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shippingMode === "INDIRECT" && !data.indirectFulfillment) {
      ctx.addIssue({
        code: "custom",
        message: "Indirect fulfillment type is required.",
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

export const AdminShippingRequestReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().min(3).max(2000).optional(),
});

export const AdminShippingRequestListQuerySchema = z.object({
  tab: z.enum(["pending", "approved", "rejected"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type AdminVendorShippingSetInput = z.infer<typeof AdminVendorShippingSetSchema>;
export type AdminShippingRequestReviewInput = z.infer<typeof AdminShippingRequestReviewSchema>;
