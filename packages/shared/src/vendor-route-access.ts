import {
  VENDOR_PERMISSION_CODES,
  vendorHasPermission,
  type VendorPermissionCode,
} from "./vendor-permissions";

export { VENDOR_PERMISSION_CODES, type VendorPermissionCode };

export type VendorNavItemId =
  | "dashboard"
  | "shop"
  | "products"
  | "questions"
  | "reviews"
  | "orders"
  | "coupons"
  | "payout"
  | "operations"
  | "kyc"
  | "store"
  | "invoiceProfile"
  | "setup"
  | "team"
  | "plans";

/** Navbar entries for vendor role (order preserved). `permission: null` = always visible. */
export const VENDOR_NAV_ITEMS: ReadonlyArray<{
  id: VendorNavItemId;
  href: string;
  permission: VendorPermissionCode | null;
}> = [
  { id: "dashboard", href: "/dashboard", permission: "vendor:dashboard:read" },
  { id: "shop", href: "/products", permission: null },
  { id: "products", href: "/vendor/products", permission: "vendor:products:read" },
  { id: "questions", href: "/vendor/questions", permission: "vendor:products:qna:read" },
  { id: "reviews", href: "/vendor/reviews", permission: "vendor:products:read" },
  { id: "orders", href: "/vendor/orders", permission: "vendor:orders:read" },
  { id: "coupons", href: "/vendor/coupons", permission: "vendor:coupons:read" },
  { id: "payout", href: "/vendor/payout", permission: "vendor:wallet:read" },
  { id: "operations", href: "/vendor/operations", permission: "vendor:wallet:read" },
  { id: "kyc", href: "/vendor/kyc", permission: "vendor:wallet:read" },
  { id: "store", href: "/vendor/store", permission: "vendor:store:read" },
  { id: "invoiceProfile", href: "/vendor/invoice-profile", permission: "vendor:store:read" },
  { id: "setup", href: "/vendor/setup", permission: "vendor:setup:read" },
  { id: "team", href: "/vendor/team", permission: "vendor:team:read" },
  { id: "plans", href: "/vendor/plans", permission: "vendor:dashboard:read" },
] as const;

/** Longest prefix first so `/vendor/products/...` matches before `/vendor/...`. */
const VENDOR_PATH_RULES = [
  { prefix: "/vendor/products", permission: "vendor:products:read" },
  { prefix: "/vendor/questions", permission: "vendor:products:qna:read" },
  { prefix: "/vendor/reviews", permission: "vendor:products:read" },
  { prefix: "/vendor/orders", permission: "vendor:orders:read" },
  { prefix: "/vendor/coupons", permission: "vendor:coupons:read" },
  { prefix: "/vendor/payout", permission: "vendor:wallet:read" },
  { prefix: "/vendor/kyc", permission: "vendor:wallet:read" },
  { prefix: "/vendor/operations", permission: "vendor:wallet:read" },
  { prefix: "/vendor/store", permission: "vendor:store:read" },
  { prefix: "/vendor/invoice-profile", permission: "vendor:store:read" },
  { prefix: "/vendor/setup", permission: "vendor:setup:read" },
  { prefix: "/vendor/team", permission: "vendor:team:read" },
  { prefix: "/vendor/plans", permission: "vendor:dashboard:read" },
] satisfies ReadonlyArray<{ prefix: string; permission: VendorPermissionCode }>;

const VENDOR_PATH_RULES_BY_PREFIX_LENGTH = [...VENDOR_PATH_RULES].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export function requiredVendorPermissionForPath(pathname: string): VendorPermissionCode | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  if (path === "/dashboard") return "vendor:dashboard:read";
  for (const rule of VENDOR_PATH_RULES_BY_PREFIX_LENGTH) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.permission;
    }
  }
  return null;
}

export function canAccessVendorPath(
  granted: readonly VendorPermissionCode[],
  pathname: string,
): boolean {
  const required = requiredVendorPermissionForPath(pathname);
  if (!required) return true;
  return vendorHasPermission(granted, required);
}

export function firstAllowedVendorNavHref(
  granted: readonly VendorPermissionCode[],
): string | null {
  for (const item of VENDOR_NAV_ITEMS) {
    if (!item.permission || vendorHasPermission(granted, item.permission)) {
      return item.href;
    }
  }
  return null;
}
