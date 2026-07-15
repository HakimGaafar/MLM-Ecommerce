export const PRODUCT_STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "ON_HOLD", "REJECTED"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABEL_KEYS: Record<ProductStatus, string> = {
  DRAFT: "draft",
  PENDING: "pending",
  PUBLISHED: "published",
  ON_HOLD: "onHold",
  REJECTED: "rejected",
};
