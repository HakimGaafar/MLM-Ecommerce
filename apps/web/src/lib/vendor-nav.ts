import { VENDOR_NAV_ITEMS, vendorHasPermission, type VendorPermissionCode } from "@mlm/shared";

export type VendorNavLink = {
  href: string;
  label: string;
  activeMatchStartsWith?: boolean;
};

export function buildVendorNavLinks(
  labels: Record<
    "dashboard" | "shop" | "products" | "questions" | "reviews" | "team" | "plans" | "orders" | "coupons" | "payout" | "operations" | "kyc" | "store" | "invoiceProfile" | "setup",
    string
  >,
  permissions: readonly VendorPermissionCode[],
): VendorNavLink[] {
  return VENDOR_NAV_ITEMS.filter(
    (item) => !item.permission || vendorHasPermission(permissions, item.permission),
  ).map((item) => ({
    href: item.href,
    label: labels[item.id],
    activeMatchStartsWith: item.href.startsWith("/vendor") || item.href === "/products",
  }));
}
