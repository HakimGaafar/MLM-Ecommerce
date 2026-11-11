import { z } from "zod";

/** Any market row id (seed market_* or wizard cuid). */
const MarketIdSchema = z.string().trim().min(1).max(64);

export const ProductVariantOfferInputSchema = z.object({
  marketId: MarketIdSchema,
  price: z.coerce.number().positive().max(1_000_000),
  currency: z.string().trim().length(3).toUpperCase(),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
});

export const ProductVariantInputSchema = z.object({
  /** Existing variant id on update; omit for new rows. */
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  sku: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9_-]*$/, "SKU must be alphanumeric (dashes/underscores allowed).")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  options: z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(80)).optional().default({}),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  isActive: z.boolean().optional().default(true),
  offers: z.array(ProductVariantOfferInputSchema).min(1),
});

export const ProductVariantsSchema = z.array(ProductVariantInputSchema).max(100);

export type ProductVariantInput = z.infer<typeof ProductVariantInputSchema>;
export type ProductVariantOfferInput = z.infer<typeof ProductVariantOfferInputSchema>;
