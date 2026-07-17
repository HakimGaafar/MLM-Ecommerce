import { z } from "zod";

export const STORE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SellerStoreFieldsSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(STORE_SLUG_REGEX, "Slug must use lowercase letters, numbers, and hyphens"),
  countryCode: z.string().trim().toUpperCase().length(2),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(2).max(20),
  about: z.string().trim().max(5000).optional().or(z.literal("")),
  planCode: z.literal("FREE").default("FREE"),
  internationalSalesConsent: z.boolean().optional(),
});

export const SellerOnboardSchema = SellerStoreFieldsSchema.extend({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
  confirmPassword: z.string().min(10).max(128),
  acceptPlan: z.literal(true),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SellerStoreFieldsInput = z.infer<typeof SellerStoreFieldsSchema>;
export type SellerOnboardInput = z.infer<typeof SellerOnboardSchema>;
