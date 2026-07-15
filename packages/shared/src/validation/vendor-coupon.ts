import { z } from "zod";
import { COUPON_DISCOUNT_TYPES, COUPON_LIST_TABS, COUPON_STATUSES } from "../coupon-status";
import { PaginationQuerySchema } from "./pagination";

const couponCode = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric (dashes/underscores allowed).")
  .transform((v) => v.toUpperCase());

export const VendorCouponCreateSchema = z
  .object({
    code: couponCode,
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(COUPON_DISCOUNT_TYPES),
    discountValue: z.coerce.number().positive().max(1_000_000),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    usageLimit: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENT" && v.discountValue > 100) {
      ctx.addIssue({ code: "custom", message: "Percent discount cannot exceed 100.", path: ["discountValue"] });
    }
    if (v.startsAt && v.endsAt && new Date(v.startsAt) > new Date(v.endsAt)) {
      ctx.addIssue({ code: "custom", message: "End date must be after start date.", path: ["endsAt"] });
    }
  });

export const VendorCouponUpdateSchema = z
  .object({
    description: z.string().trim().max(500).optional().nullable(),
    discountType: z.enum(COUPON_DISCOUNT_TYPES).optional(),
    discountValue: z.coerce.number().positive().max(1_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    status: z.enum(COUPON_STATUSES).optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    usageLimit: z.coerce.number().int().positive().max(1_000_000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENT" && v.discountValue != null && v.discountValue > 100) {
      ctx.addIssue({ code: "custom", message: "Percent discount cannot exceed 100.", path: ["discountValue"] });
    }
    if (v.startsAt && v.endsAt && new Date(v.startsAt) > new Date(v.endsAt)) {
      ctx.addIssue({ code: "custom", message: "End date must be after start date.", path: ["endsAt"] });
    }
  });

export const VendorCouponListQuerySchema = PaginationQuerySchema.extend({
  tab: z.enum(COUPON_LIST_TABS).optional(),
});

export const VendorOrderListQuerySchema = PaginationQuerySchema.extend({
  tab: z
    .enum(["all", "completed", "processing", "pending", "failed", "canceled", "refunded"])
    .optional()
    .default("all"),
  q: z.string().trim().max(120).optional(),
});

export type VendorCouponCreateInput = z.infer<typeof VendorCouponCreateSchema>;
export type VendorCouponUpdateInput = z.infer<typeof VendorCouponUpdateSchema>;
