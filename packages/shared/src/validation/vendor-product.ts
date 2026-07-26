import { z } from "zod";
import { PRODUCT_FULFILLMENT_TYPES } from "../product-fulfillment";
import { PRODUCT_STATUSES } from "../product-status";
import { VendorProductImagesSchema } from "./catalog";
import { PaginationQuerySchema } from "./pagination";
import { ProductMarketOffersSchema } from "./product-market-offer";
import { SeoMetaDescriptionSchema, SeoMetaTitleSchema } from "./seo";

const ProductFulfillmentTypeSchema = z.enum(PRODUCT_FULFILLMENT_TYPES);

export const VendorProductCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    /** Legacy single price — optional when `offers` is provided. */
    price: z.coerce.number().positive().max(1_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    categoryId: z.string().trim().min(1),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    offers: ProductMarketOffersSchema.optional(),
    images: VendorProductImagesSchema.min(1, { message: "At least one product image is required" }),
    metaTitle: SeoMetaTitleSchema,
    metaDescription: SeoMetaDescriptionSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.offers?.length && value.price == null) {
      ctx.addIssue({
        code: "custom",
        message: "Price or market offers are required.",
        path: ["price"],
      });
    }
  });

export const VendorProductUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    price: z.coerce.number().positive().max(1_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    categoryId: z.string().trim().min(1).optional(),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    offers: ProductMarketOffersSchema.optional(),
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
