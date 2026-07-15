import { z } from "zod";

/** Optional SEO title (Google ~60 chars; allow small buffer). */
export const SeoMetaTitleSchema = z.string().trim().max(70).optional();

/** Optional SEO description (~155 chars). */
export const SeoMetaDescriptionSchema = z.string().trim().max(160).optional();

export const SeoMetaFieldsSchema = z.object({
  metaTitle: SeoMetaTitleSchema,
  metaDescription: SeoMetaDescriptionSchema,
});

export type SeoMetaFieldsInput = z.infer<typeof SeoMetaFieldsSchema>;

export function seoFieldsToNullables(input?: SeoMetaFieldsInput) {
  if (!input) return {};
  const out: { metaTitle?: string | null; metaDescription?: string | null } = {};
  if (input.metaTitle !== undefined) {
    out.metaTitle = input.metaTitle.trim() || null;
  }
  if (input.metaDescription !== undefined) {
    out.metaDescription = input.metaDescription.trim() || null;
  }
  return out;
}
