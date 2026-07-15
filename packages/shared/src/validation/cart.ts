import { z } from "zod";

export const CartAddItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const CartUpdateItemQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
});

export type CartAddItemInput = z.infer<typeof CartAddItemSchema>;
export type CartUpdateItemQuantityInput = z.infer<typeof CartUpdateItemQuantitySchema>;
