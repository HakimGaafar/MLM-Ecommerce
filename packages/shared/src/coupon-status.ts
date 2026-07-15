export const COUPON_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED"] as const;

export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const COUPON_DISCOUNT_TYPES = ["PERCENT", "FIXED"] as const;

export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

export const COUPON_LIST_TABS = ["ALL", "ACTIVE", "DRAFT", "EXPIRED"] as const;

export type CouponListTab = (typeof COUPON_LIST_TABS)[number];
