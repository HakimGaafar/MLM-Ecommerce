import { z } from "zod";
import { SeoMetaDescriptionSchema, SeoMetaTitleSchema } from "./seo";

export const VendorStoreUpdateSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  about: z.string().trim().max(5000).optional().or(z.literal("")),
  metaTitle: SeoMetaTitleSchema,
  metaDescription: SeoMetaDescriptionSchema,
});

export type VendorStoreUpdateInput = z.infer<typeof VendorStoreUpdateSchema>;
