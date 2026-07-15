import { z } from "zod";

export const VendorReviewListTab = ["all", "low", "commented"] as const;
export type VendorReviewListTab = (typeof VendorReviewListTab)[number];

export const VendorReviewListQuerySchema = z.object({
  tab: z.enum(VendorReviewListTab).optional().default("all"),
  q: z.string().trim().max(200).optional(),
  productId: z.string().trim().min(1).optional(),
  orderItemId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(5),
});

export type VendorReviewListQuery = z.infer<typeof VendorReviewListQuerySchema>;
