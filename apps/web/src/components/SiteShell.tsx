import { cookies } from "next/headers";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import AppShell from "@/components/shell/AppShell";
import { ACTIVE_ROLE_COOKIE, getRolesUserCanSwitch, resolveActiveRole } from "@/lib/active-role";
import {
  buildAdminSidebarSections,
  buildCustomerSidebarSections,
  buildHeaderNav,
  buildSidebarNav,
  buildVendorSidebarSections,
  roleSwitcherLabel,
  type ShellNavDict,
} from "@/lib/build-app-nav";
import { getVendorPermissionsForOwner } from "@/lib/vendor-access";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket, listMarketsForPicker } from "@/lib/market-server";
import { getThemePreference } from "@/lib/theme-preference";
import { getServerSession } from "@/lib/server-session";
import { getBrandName } from "@/lib/brand";

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const locale = await getAppLocale();
  const theme = await getThemePreference();
  const activeMarket = await getActiveMarket();
  const marketRows = await listMarketsForPicker();
  const dict = locale === "ar" ? ar : en;
  const appName = getBrandName(locale);
  const cookieStore = await cookies();
  const roles = session?.roles ?? [];
  const activeRole = resolveActiveRole(roles, cookieStore.get(ACTIVE_ROLE_COOKIE)?.value);
  const isLoggedIn = Boolean(session);

  const vendorPermissions =
    session?.sub && roles.includes("VENDOR")
      ? await getVendorPermissionsForOwner(session.sub)
      : [];

  const navDict: ShellNavDict = {
    siteNav: dict.siteNav,
    customerNav: dict.customerNav,
    vendorNav: dict.vendorNav,
    vendorDashboard: dict.vendorDashboard,
    adminNav: dict.adminNav,
    adminOrderOps: dict.adminOrderOps,
    shell: dict.shell,
  };

  const headerLinks = buildHeaderNav(activeRole, navDict, isLoggedIn);
  const sidebarSections =
    activeRole === "CUSTOMER"
      ? buildCustomerSidebarSections(navDict)
      : activeRole === "ADMIN"
        ? buildAdminSidebarSections(navDict, roles)
        : activeRole === "VENDOR"
          ? buildVendorSidebarSections(navDict, vendorPermissions)
          : undefined;
  const sidebarLinks = buildSidebarNav(activeRole, navDict, vendorPermissions, roles);

  const switchable = getRolesUserCanSwitch(roles);
  const roleOptions = switchable.map((role) => ({
    role,
    label: roleSwitcherLabel(role, navDict),
  }));

  const menuItems: { href: string; label: string }[] = [];
  if (activeRole === "CUSTOMER") {
    menuItems.push(
      { href: "/dashboard", label: dict.customerNav.home },
      { href: "/orders", label: dict.customerNav.orders },
      { href: "/cashback", label: dict.customerNav.cashback },
      { href: "/profile", label: dict.customerNav.profile },
    );
  }

  const menuLabel =
    activeRole === "ADMIN"
      ? dict.adminNav.menu
      : activeRole === "VENDOR"
        ? dict.vendorNav.menu
        : dict.customerNav.menu;

  const logoutLabel = isLoggedIn
    ? activeRole === "ADMIN"
      ? dict.adminNav.logout
      : activeRole === "VENDOR"
        ? dict.vendorNav.logout
        : dict.customerNav.logout
    : undefined;

  const sidebarTitle =
    activeRole === "ADMIN"
      ? dict.shell.sidebarAdmin
      : activeRole === "VENDOR"
        ? dict.shell.sidebarVendor
        : "";

  return (
    <AppShell
      locale={locale}
      appName={appName}
      isLoggedIn={isLoggedIn}
      headerLinks={headerLinks}
      sidebarLinks={sidebarLinks}
      sidebarSections={sidebarSections}
      sidebarTitle={sidebarTitle}
      menuLabel={menuLabel}
      menuItems={menuItems}
      roleOptions={roleOptions}
      activeRole={activeRole}
      logoutLabel={logoutLabel}
      theme={theme}
      themeLabels={dict.shell.theme}
      roleLabels={{ section: dict.shell.roleSection }}
      languageSwitcher={{ enabled: true, labels: dict.navLanguage }}
      guestLanguageMode={!roles.includes("CUSTOMER")}
      guestLoginLabel={!isLoggedIn ? dict.siteNav.login : undefined}
      marketSwitcher={{
        activeMarketCode: activeMarket.code,
        options: marketRows.map((m) => ({
          code: m.code,
          label: locale === "ar" ? m.nameAr : m.nameEn,
          currency: m.defaultCurrency,
        })),
        labels: dict.marketSwitcher,
      }}
    >
      {children}
    </AppShell>
  );
}
