import { z } from "zod";
import { PRODUCT_FULFILLMENT_TYPES } from "../product-fulfillment";
import { PRODUCT_STATUSES } from "../product-status";
import { VendorProductImagesSchema } from "./catalog";
import { PaginationQuerySchema } from "./pagination";
import { ProductMarketOffersSchema } from "./product-market-offer";
import { SeoMetaDescriptionSchema, SeoMetaTitleSchema } from "./seo";

const ProductFulfillmentTypeSchema = z.enum(PRODUCT_FULFILLMENT_TYPES);

const ProductServiceAreaModeSchema = z.enum(["ALL", "SPECIFIC"]);

const ProductServiceCitiesSchema = z
  .array(
    z.object({
      countryCode: z.string().trim().length(2).toUpperCase(),
      city: z.string().trim().min(2).max(120),
    }),
  )
  .max(100)
  .optional()
  .default([]);

export const VendorProductCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    /** Legacy single price — optional when `offers` is provided. */
    price: z.coerce.number().positive().max(1_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    categoryId: z.string().trim().min(1),
    fulfillmentType: ProductFulfillmentTypeSchema.optional(),
    offers: ProductMarketOffersSchema.optional(),
    serviceAreaMode: ProductServiceAreaModeSchema.default("ALL"),
    serviceCities: ProductServiceCitiesSchema,
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
    if (value.serviceAreaMode === "SPECIFIC" && (value.serviceCities?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one city or choose All cities.",
        path: ["serviceCities"],
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
    serviceAreaMode: ProductServiceAreaModeSchema.optional(),
    serviceCities: ProductServiceCitiesSchema.optional(),
    images: VendorProductImagesSchema.optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    metaTitle: SeoMetaTitleSchema,
    metaDescription: SeoMetaDescriptionSchema,
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: "custom", message: "At least one field is required" });
    }
    if (value.serviceAreaMode === "SPECIFIC" && (value.serviceCities?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one city or choose All cities.",
        path: ["serviceCities"],
      });
    }
  });

export const VendorProductListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export type VendorProductCreateInput = z.infer<typeof VendorProductCreateSchema>;
export type VendorProductUpdateInput = z.infer<typeof VendorProductUpdateSchema>;
