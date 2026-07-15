import { z } from "zod";
import { ProductImageUrlSchema } from "./catalog";

export const VENDOR_PRODUCT_IMPORT_MAX_ROWS = 50;

export const VendorProductImportRequestSchema = z.object({
  csv: z.string().min(1).max(512_000),
});

export type VendorProductImportRequest = z.infer<typeof VendorProductImportRequestSchema>;

export const VendorProductImportRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.coerce.number().positive().max(1_000_000),
  category: z.string().trim().min(1).max(120),
  imageUrl: ProductImageUrlSchema,
  qty: z.coerce.number().int().nonnegative().optional(),
});

export type VendorProductImportRowInput = z.infer<typeof VendorProductImportRowSchema>;

/** Example CSV for vendor download (includes optional qty column). */
export const VENDOR_PRODUCT_IMPORT_CSV_TEMPLATE = `name,price,category,image_url,qty
Sample product,99.00,electronics,https://example.com/image.jpg,10
`;
