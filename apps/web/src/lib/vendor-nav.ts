import {
  VENDOR_NAV_ITEMS,
  vendorHasPermission,
  type VendorNavItemId,
  type VendorPermissionCode,
} from "@mlm/shared";

export type VendorNavLink = {
  href: string;
  label: string;
  activeMatchStartsWith?: boolean;
};

export function buildVendorNavLinks(
  labels: Partial<Record<VendorNavItemId, string>> & Record<string, string>,
  permissions: readonly VendorPermissionCode[],
): VendorNavLink[] {
  return VENDOR_NAV_ITEMS.filter(
    (item) => !item.permission || vendorHasPermission(permissions, item.permission),
  ).map((item) => ({
    href: item.href,
    label: labels[item.id] ?? item.id,
    activeMatchStartsWith: item.href.startsWith("/vendor") || item.href === "/products",
  }));
}
