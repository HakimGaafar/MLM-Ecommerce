import { VENDOR_NAV_ITEMS, vendorHasPermission, type VendorPermissionCode } from "@mlm/shared";
import type { AppRole } from "@/lib/server-session";

export type ShellNavItem = {
  href: string;
  label: string;
  activeMatchStartsWith?: boolean;
};

export type ShellNavSection = {
  id: string;
  label?: string;
  items: ShellNavItem[];
};

export function flattenShellNavSections(sections: readonly ShellNavSection[]): ShellNavItem[] {
  return sections.flatMap((section) => section.items);
}

function normalizeNavPath(pathname: string | null | undefined): string {
  return pathname?.split("?")[0]?.replace(/\/$/, "") || "";
}

function navPathMatches(path: string, href: string, prefix: boolean): boolean {
  if (!prefix) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/** Picks the most specific sidebar/header link when several prefixes match (e.g. settlements vs settlements/released). */
export function isShellNavItemActive(
  pathname: string | null | undefined,
  link: ShellNavItem,
  allItems: readonly ShellNavItem[],
): boolean {
  const path = normalizeNavPath(pathname);
  if (!path) return false;

  const prefix = link.activeMatchStartsWith ?? false;
  if (!navPathMatches(path, link.href, prefix)) return false;

  if (!prefix) return true;

  const hasMoreSpecificMatch = allItems.some((other) => {
    if (other.href === link.href || other.href.length <= link.href.length) return false;
    if (!other.href.startsWith(`${link.href}/`) && other.href !== link.href) return false;
    const otherPrefix = other.activeMatchStartsWith ?? false;
    return navPathMatches(path, other.href, otherPrefix);
  });

  return !hasMoreSpecificMatch;
}

export type ShellNavDict = {
  siteNav: { home: string; products: string; stores: string };
  customerNav: {
    home: string;
    shop: string;
    cart: string;
    checkout: string;
    orders: string;
    returns: string;
    cashback: string;
    affiliate: string;
    kyc: string;
    profile: string;
  };
  vendorNav: {
    dashboard: string;
    products: string;
    questions: string;
    reviews: string;
    team: string;
    plans: string;
    orders: string;
    coupons: string;
    payout: string;
    operations: string;
    kyc: string;
    store: string;
    invoiceProfile: string;
  };
  vendorDashboard: { linkSetup: string };
  adminNav: {
    dashboard: string;
    analytics: string;
    orders: string;
    returns: string;
    users: string;
    vendors: string;
    pendingProducts: string;
    withdrawals: string;
    kyc: string;
    settlements: string;
    settlementsReleased: string;
    affiliates: string;
    settings: string;
    markets: string;
  };
  adminOrderOps: {
    nav: { stuckOrders: string };
  };
  shell: {
    roleAdmin: string;
    roleVendor: string;
    roleCustomer: string;
    sidebarAdmin: string;
    sidebarVendor: string;
    sidebarCustomer: string;
    customerNavSections: {
      overview: string;
      orders: string;
      wallet: string;
      account: string;
      shop: string;
    };
    theme: { light: string; dark: string };
  };
};

export function buildHeaderNav(
  role: AppRole | null,
  dict: ShellNavDict,
  isLoggedIn: boolean,
): ShellNavItem[] {
  if (!isLoggedIn) {
    return [
      { href: "/", label: dict.siteNav.home },
      { href: "/products", label: dict.siteNav.products, activeMatchStartsWith: true },
      { href: "/stores", label: dict.siteNav.stores, activeMatchStartsWith: true },
    ];
  }

  const shared: ShellNavItem[] = [
    { href: "/dashboard", label: dict.customerNav.home },
    { href: "/products", label: dict.siteNav.products, activeMatchStartsWith: true },
    { href: "/stores", label: dict.siteNav.stores, activeMatchStartsWith: true },
  ];

  return shared;
}

export function buildSidebarNav(
  role: AppRole | null,
  dict: ShellNavDict,
  vendorPermissions: readonly VendorPermissionCode[],
  allRoles: string[] = [],
): ShellNavItem[] {
  if (!role) return [];

  if (role === "CUSTOMER") {
    return flattenShellNavSections(buildCustomerSidebarSections(dict));
  }

  if (role === "ADMIN") {
    return [
      { href: "/admin/analytics", label: dict.adminNav.analytics, activeMatchStartsWith: true },
      {
        href: "/admin/products/pending",
        label: dict.adminNav.pendingProducts,
        activeMatchStartsWith: true,
      },
      { href: "/admin/orders", label: dict.adminNav.orders, activeMatchStartsWith: true },
      {
        href: "/admin/orders/stuck",
        label: dict.adminOrderOps.nav.stuckOrders,
        activeMatchStartsWith: true,
      },
      { href: "/admin/returns", label: dict.adminNav.returns, activeMatchStartsWith: true },
      { href: "/admin/users", label: dict.adminNav.users, activeMatchStartsWith: true },
      { href: "/admin/vendors", label: dict.adminNav.vendors, activeMatchStartsWith: true },
      { href: "/admin/affiliates", label: dict.adminNav.affiliates, activeMatchStartsWith: true },
      { href: "/admin/settlements", label: dict.adminNav.settlements, activeMatchStartsWith: true },
      {
        href: "/admin/settlements/released",
        label: dict.adminNav.settlementsReleased,
        activeMatchStartsWith: true,
      },
      { href: "/admin/withdrawals", label: dict.adminNav.withdrawals, activeMatchStartsWith: true },
      { href: "/admin/kyc", label: dict.adminNav.kyc, activeMatchStartsWith: true },
      ...(allRoles.includes("SUPER_ADMIN")
        ? [
            { href: "/admin/markets", label: dict.adminNav.markets, activeMatchStartsWith: true },
            { href: "/admin/settings", label: dict.adminNav.settings, activeMatchStartsWith: true },
          ]
        : []),
    ];
  }

  if (role === "VENDOR") {
    const labels = {
      products: dict.vendorNav.products,
      questions: dict.vendorNav.questions,
      reviews: dict.vendorNav.reviews,
      team: dict.vendorNav.team,
      plans: dict.vendorNav.plans,
      orders: dict.vendorNav.orders,
      coupons: dict.vendorNav.coupons,
      payout: dict.vendorNav.payout,
      operations: dict.vendorNav.operations,
      kyc: dict.vendorNav.kyc,
      store: dict.vendorNav.store,
      invoiceProfile: dict.vendorNav.invoiceProfile,
      setup: dict.vendorDashboard.linkSetup,
    };
    return VENDOR_NAV_ITEMS.filter(
      (item) =>
        item.id !== "dashboard" &&
        item.id !== "shop" &&
        (!item.permission || vendorHasPermission(vendorPermissions, item.permission)),
    ).map((item) => ({
      href: item.href,
      label: labels[item.id as keyof typeof labels] ?? item.id,
      activeMatchStartsWith: item.href.startsWith("/vendor"),
    }));
  }

  return [];
}

/** Grouped customer account sidebar (Phase IX1). */
export function buildCustomerSidebarSections(dict: ShellNavDict): ShellNavSection[] {
  const sections = dict.shell.customerNavSections;
  return [
    {
      id: "overview",
      items: [{ href: "/dashboard", label: sections.overview, activeMatchStartsWith: true }],
    },
    {
      id: "account",
      label: sections.account,
      items: [
        { href: "/kyc", label: dict.customerNav.kyc, activeMatchStartsWith: true },
        { href: "/profile", label: dict.customerNav.profile, activeMatchStartsWith: true },
      ],
    },
    {
      id: "shop",
      label: sections.shop,
      items: [
        { href: "/cart", label: dict.customerNav.cart, activeMatchStartsWith: true },
        { href: "/checkout", label: dict.customerNav.checkout, activeMatchStartsWith: true },
      ],
    },
    {
      id: "orders",
      label: sections.orders,
      items: [
        { href: "/orders", label: dict.customerNav.orders, activeMatchStartsWith: true },
        { href: "/returns", label: dict.customerNav.returns, activeMatchStartsWith: true },
      ],
    },
    {
      id: "wallet",
      label: sections.wallet,
      items: [
        { href: "/cashback", label: dict.customerNav.cashback, activeMatchStartsWith: true },
        { href: "/affiliate", label: dict.customerNav.affiliate, activeMatchStartsWith: true },
      ],
    },
  ];
}

export function roleSwitcherLabel(role: AppRole, dict: ShellNavDict): string {
  if (role === "ADMIN") return dict.shell.roleAdmin;
  if (role === "VENDOR") return dict.shell.roleVendor;
  return dict.shell.roleCustomer;
}
