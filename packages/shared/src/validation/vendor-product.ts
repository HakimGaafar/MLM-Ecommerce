import { z } from "zod";
import { PRODUCT_FULFILLMENT_TYPES } from "../product-fulfillment";
import { PRODUCT_STATUSES } from "../product-status";
import { VendorProductImagesSchema } from "./catalog";
import { PaginationQuerySchema } from "./pagination";
import { SeoMetaDescriptionSchema, SeoMetaTitleSchema } from "./seo";

const ProductFulfillmentTypeSchema = z.enum(PRODUCT_FULFILLMENT_TYPES);

export const VendorProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.coerce.number().positive().max(1_000_000),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  categoryId: z.string().trim().min(1),
  fulfillmentType: ProductFulfillmentTypeSchema.optional(),
  images: VendorProductImagesSchema.min(1, { message: "At least one product image is required" }),
  metaTitle: SeoMetaTitleSchema,
  metaDescription: SeoMetaDescriptionSchema,
});

export const VendorProductUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    price: z.coerce.number().positive().max(1_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    categoryId: z.string().trim().min(1).optional(),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    images: VendorProductImagesSchema.optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    metaTitle: SeoMetaTitleSchema,
    metaDescription: SeoMetaDescriptionSchema,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const VendorProductListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export type VendorProductCreateInput = z.infer<typeof VendorProductCreateSchema>;
export type VendorProductUpdateInput = z.infer<typeof VendorProductUpdateSchema>;
