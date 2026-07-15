export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginatedResult,
  normalizePagination,
  parsePaginationSearchParams,
  type PaginatedResult,
} from "./pagination";

export const ROLE_CODES = ["ADMIN", "VENDOR", "CUSTOMER", "AFFILIATE"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ORDER_STATUS = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
  "CANCELED",
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];

export const LEDGER_STATUS = ["PENDING", "APPROVED", "DECLINED", "REVERSED"] as const;

export type LedgerStatus = (typeof LEDGER_STATUS)[number];

export * from "./market";
export * from "./validation/pagination";
export * from "./validation/customer-profile";
export * from "./validation/cart";
export * from "./product-status";
export * from "./coupon-status";
export * from "./validation/catalog";
export * from "./validation/vendor-product";
export * from "./validation/vendor-setup";
export * from "./validation/admin-product-approval";
export * from "./validation/admin-product-approval-list";
export * from "./validation/vendor-store";
export * from "./validation/seo";
export * from "./validation/vendor-order";
export * from "./validation/vendor-order-patch";
export * from "./validation/admin-order";
export * from "./validation/vendor-coupon";
export * from "./validation/checkout";
export * from "./validation/order-return";
export * from "./validation/order-item-rating";
export * from "./validation/product-question";
export * from "./validation/vendor-reviews";
export * from "./validation/vendor-product-import";
export * from "./validation/vendor-team";
export * from "./csv-parse";
export * from "./validation/customer-shipping-address";
export * from "./types/customer-profile";
export * from "./types/customer-shipping-address";
export * from "./checkout-pricing";
export * from "./shipping-pricing";
export * from "./product-fulfillment";
export * from "./vendor-permissions";
export * from "./vendor-route-access";
export * from "./validation/vendor-permissions";
export * from "./validation/seller-onboarding";
export * from "./validation/vendor-invoice-profile";
export * from "./validation/vendor-shipping";
export * from "./validation/admin-vendor-shipping";
export * from "./validation/admin-platform-config";
export * from "./validation/admin-markets";
export * from "./validation/security";
export * from "./validation/order-ops";
export * from "./vendor-slug";
