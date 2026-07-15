import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../pagination";

export const PUBLIC_PRODUCT_SORT = ["newest", "price_asc", "price_desc", "name_asc"] as const;
export type PublicProductSort = (typeof PUBLIC_PRODUCT_SORT)[number];

export const PublicProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  /** @deprecated Use pageSize — still accepted as alias */
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  categoryId: z.string().trim().min(1).optional(),
  categorySlug: z.string().trim().min(1).optional(),
  sort: z.enum(PUBLIC_PRODUCT_SORT).optional(),
  vendorId: z.string().trim().min(1).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  q: z.string().trim().max(120).optional(),
});

export type PublicProductListQuery = z.infer<typeof PublicProductListQuerySchema>;

/** Absolute http(s) URL or site-relative path (e.g. `/uploads/products/...`). */
export const ProductImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (val) => val.startsWith("/") || /^https?:\/\//i.test(val),
    { message: "Must be a full URL or a path starting with /" },
  );

export const ProductImageInputSchema = z.object({
  url: ProductImageUrlSchema,
  sortOrder: z.coerce.number().int().min(0).max(99).optional(),
  /** When omitted for all images, the first image is treated as primary on the server. */
  isPrimary: z.boolean().optional(),
});

export const VendorProductImagesSchema = z.array(ProductImageInputSchema).max(8);
