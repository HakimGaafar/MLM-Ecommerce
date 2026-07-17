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
