import { z } from "zod";

const percent = z.coerce.number().min(0).max(100);
const optionalUrl = z
  .union([z.string().url().max(500), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null ? undefined : v));
const optionalText = z
  .union([z.string().max(20_000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null ? undefined : v));

export const AdminPlatformConfigUpdateSchema = z
  .object({
    cashbackPercent: percent,
    affiliatePoolPercent: percent,
    affiliateLevel1Percent: percent,
    affiliateLevel2Percent: percent,
    affiliateLevel3Percent: percent,
    affiliateLevel4Percent: percent,
    vendorPercent: percent,
    platformPercent: percent,
    vatPercent: percent,
    minWithdrawalAmount: z.coerce.number().min(1).max(1_000_000),
    returnWindowDays: z.coerce.number().int().min(1).max(365),
    settlementWindowDays: z.coerce.number().int().min(1).max(90),
    referralDepthMax: z.coerce.number().int().min(1).max(4),
    missingAncestorPolicy: z.enum(["KEEP_BY_PLATFORM", "REDISTRIBUTE_TO_EXISTING_LEVELS"]),
    termsUrl: optionalUrl,
    termsText: optionalText,
    privacyUrl: optionalUrl,
    privacyText: optionalText,
    returnPolicyUrl: optionalUrl,
    returnPolicyText: optionalText,
    showTapGateway: z.boolean(),
    showHyperPayGateway: z.boolean(),
    showMyFatoorahGateway: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const splitSum = data.vendorPercent + data.platformPercent;
    if (Math.abs(splitSum - 100) > 0.01) {
      ctx.addIssue({
        code: "custom",
        message: "Vendor and platform commission must total 100%.",
        path: ["platformPercent"],
      });
    }
  });

export type AdminPlatformConfigUpdateInput = z.infer<typeof AdminPlatformConfigUpdateSchema>;

export const AdminShippingRateUpdateSchema = z.object({
  marketCode: z.string().trim().toUpperCase(),
  code: z.string().trim().min(3).max(64),
  amount: z.coerce.number().min(0).max(1_000_000),
  perUnit: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type AdminShippingRateUpdateInput = z.infer<typeof AdminShippingRateUpdateSchema>;

export const AdminMarketUpdateSchema = z.object({
  nameEn: z.string().trim().min(2).max(120).optional(),
  nameAr: z.string().trim().min(2).max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  geoCountryCodes: z.array(z.string().trim().toUpperCase().length(2)).max(20).optional(),
  isActive: z.boolean().optional(),
});

export type AdminMarketUpdateInput = z.infer<typeof AdminMarketUpdateSchema>;

export const AdminProductCategoryUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens"),
  nameEn: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export type AdminProductCategoryUpsertInput = z.infer<typeof AdminProductCategoryUpsertSchema>;

export const AdminMarketBannerUpsertSchema = z.object({
  titleEn: z.string().trim().min(2).max(200),
  titleAr: z.string().trim().min(2).max(200),
  subtitleEn: z.string().trim().max(500).optional().nullable(),
  subtitleAr: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.union([z.string().url().max(500), z.literal(""), z.null()]).optional(),
  linkUrl: z.union([z.string().url().max(500), z.literal(""), z.null()]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export type AdminMarketBannerUpsertInput = z.infer<typeof AdminMarketBannerUpsertSchema>;
