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
  collapsible?: boolean;
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
  siteNav: { home: string; products: string; stores: string; contact: string };
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
    contactInquiries: string;
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
    adminNavSections: {
      overview: string;
      commerce: string;
      operations: string;
      people: string;
      finance: string;
      platform: string;
    };
    vendorNavSections: {
      catalog: string;
      sales: string;
      finance: string;
      team: string;
      store: string;
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
      { href: "/contact", label: dict.siteNav.contact },
    ];
  }

  const shared: ShellNavItem[] = [
    { href: "/dashboard", label: dict.customerNav.home },
    { href: "/products", label: dict.siteNav.products, activeMatchStartsWith: true },
    { href: "/stores", label: dict.siteNav.stores, activeMatchStartsWith: true },
    { href: "/contact", label: dict.siteNav.contact },
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
    return flattenShellNavSections(buildAdminSidebarSections(dict, allRoles));
  }

  if (role === "VENDOR") {
    return flattenShellNavSections(buildVendorSidebarSections(dict, vendorPermissions));
  }

  return [];
}

export function buildAdminSidebarSections(
  dict: ShellNavDict,
  allRoles: readonly string[] = [],
): ShellNavSection[] {
  const labels = dict.shell.adminNavSections;
  const item = (href: string, label: string): ShellNavItem => ({
    href,
    label,
    activeMatchStartsWith: true,
  });

  const sections: ShellNavSection[] = [
    {
      id: "admin-overview",
      label: labels.overview,
      items: [item("/admin/analytics", dict.adminNav.analytics)],
    },
    {
      id: "admin-commerce",
      label: labels.commerce,
      items: [
        item("/admin/products/pending", dict.adminNav.pendingProducts),
        item("/admin/orders", dict.adminNav.orders),
        item("/admin/returns", dict.adminNav.returns),
      ],
    },
    {
      id: "admin-operations",
      label: labels.operations,
      items: [
        item("/admin/orders/stuck", dict.adminOrderOps.nav.stuckOrders),
        item("/admin/kyc", dict.adminNav.kyc),
      ],
    },
    {
      id: "admin-people",
      label: labels.people,
      items: [
        item("/admin/users", dict.adminNav.users),
        item("/admin/vendors", dict.adminNav.vendors),
        item("/admin/affiliates", dict.adminNav.affiliates),
        ...(allRoles.includes("SUPER_ADMIN")
          ? [item("/admin/contact-inquiries", dict.adminNav.contactInquiries)]
          : []),
      ],
    },
    {
      id: "admin-finance",
      label: labels.finance,
      items: [
        item("/admin/settlements", dict.adminNav.settlements),
        item("/admin/settlements/released", dict.adminNav.settlementsReleased),
        item("/admin/withdrawals", dict.adminNav.withdrawals),
      ],
    },
  ];

  if (allRoles.includes("SUPER_ADMIN")) {
    sections.push({
      id: "admin-platform",
      label: labels.platform,
      items: [
        item("/admin/markets", dict.adminNav.markets),
        item("/admin/settings", dict.adminNav.settings),
      ],
    });
  }

  return sections;
}

export function buildVendorSidebarSections(
  dict: ShellNavDict,
  vendorPermissions: readonly VendorPermissionCode[],
): ShellNavSection[] {
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
  const visible = VENDOR_NAV_ITEMS.filter(
    (item) =>
      item.id !== "dashboard" &&
      item.id !== "shop" &&
      (!item.permission || vendorHasPermission(vendorPermissions, item.permission)),
  ).map((item) => ({
    id: item.id,
    nav: {
      href: item.href,
      label: labels[item.id as keyof typeof labels] ?? item.id,
      activeMatchStartsWith: item.href.startsWith("/vendor"),
    } satisfies ShellNavItem,
  }));
  const take = (ids: readonly string[]) =>
    visible.filter((entry) => ids.includes(entry.id)).map((entry) => entry.nav);
  const sectionLabels = dict.shell.vendorNavSections;

  return [
    {
      id: "vendor-catalog",
      label: sectionLabels.catalog,
      items: take(["products", "questions", "reviews", "coupons"]),
    },
    {
      id: "vendor-sales",
      label: sectionLabels.sales,
      items: take(["orders"]),
    },
    {
      id: "vendor-finance",
      label: sectionLabels.finance,
      items: take(["plans", "payout", "operations"]),
    },
    {
      id: "vendor-team",
      label: sectionLabels.team,
      items: take(["team", "kyc"]),
    },
    {
      id: "vendor-store",
      label: sectionLabels.store,
      items: take(["setup", "store", "invoiceProfile"]),
    },
  ].filter((section) => section.items.length > 0);
}

/** Grouped customer account sidebar (Phase IX1). */
export function buildCustomerSidebarSections(dict: ShellNavDict): ShellNavSection[] {
  const sections = dict.shell.customerNavSections;
  return [
    {
      id: "account",
      label: sections.account,
      collapsible: false,
      items: [
        { href: "/kyc", label: dict.customerNav.kyc, activeMatchStartsWith: true },
        { href: "/profile", label: dict.customerNav.profile, activeMatchStartsWith: true },
      ],
    },
    {
      id: "shop",
      label: sections.shop,
      collapsible: false,
      items: [
        { href: "/cart", label: dict.customerNav.cart, activeMatchStartsWith: true },
        { href: "/checkout", label: dict.customerNav.checkout, activeMatchStartsWith: true },
      ],
    },
    {
      id: "orders",
      label: sections.orders,
      collapsible: false,
      items: [
        { href: "/orders", label: dict.customerNav.orders, activeMatchStartsWith: true },
        { href: "/returns", label: dict.customerNav.returns, activeMatchStartsWith: true },
      ],
    },
    {
      id: "wallet",
      label: sections.wallet,
      collapsible: false,
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
