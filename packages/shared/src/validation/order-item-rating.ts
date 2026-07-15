import { z } from "zod";

const stars = z.number().int().min(1).max(5);

export const OrderItemRatingUpsertSchema = z.object({
  orderItemId: z.string().trim().min(1),
  productStars: stars,
  vendorStars: stars,
  deliveryStars: stars,
  comment: z.string().trim().max(2000).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type OrderItemRatingUpsertInput = z.infer<typeof OrderItemRatingUpsertSchema>;
