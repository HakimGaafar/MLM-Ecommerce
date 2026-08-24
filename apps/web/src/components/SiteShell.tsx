import { cookies } from "next/headers";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import AppShell from "@/components/shell/AppShell";
import { ACTIVE_ROLE_COOKIE, resolveActiveRole } from "@/lib/active-role";
import {
  buildAdminSidebarSections,
  buildCustomerSidebarSections,
  buildHeaderNav,
  buildVendorSidebarSections,
  type ShellNavDict,
} from "@/lib/build-app-nav";
import { getVendorPermissionsForOwner } from "@/lib/vendor-access";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket, listMarketsForPicker } from "@/lib/market-server";
import { getThemePreference } from "@/lib/theme-preference";
import { getServerSession } from "@/lib/server-session";
import { getBrandName } from "@/lib/brand";
import { getCustomerCartItemCount } from "@mlm/domain";

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

  const headerLinks = buildHeaderNav(null, navDict, isLoggedIn);
  const cartItemCount =
    session?.sub && roles.includes("CUSTOMER")
      ? await getCustomerCartItemCount(session.sub, activeMarket.id)
      : 0;
  const customerSidebarSections = buildCustomerSidebarSections(navDict, {
    cartHasItems: cartItemCount > 0,
  });
  const vendorSidebarSections = buildVendorSidebarSections(navDict, vendorPermissions);
  const adminSidebarSections = buildAdminSidebarSections(navDict, roles);

  const menuItems: { href: string; label: string }[] = [];
  if (isLoggedIn) {
    menuItems.push({ href: "/dashboard", label: dict.customerNav.controlPanel });
  }

  const menuLabel = dict.customerNav.menu;
  const logoutLabel = isLoggedIn ? dict.customerNav.logout : undefined;
  const guestLoginHref = "/account/customer";

  return (
    <AppShell
      locale={locale}
      appName={appName}
      isLoggedIn={isLoggedIn}
      headerLinks={headerLinks}
      customerSidebarSections={customerSidebarSections}
      vendorSidebarSections={vendorSidebarSections}
      adminSidebarSections={adminSidebarSections}
      vendorSidebarTitle={dict.shell.sidebarVendor}
      adminSidebarTitle={dict.shell.sidebarAdmin}
      sidebarTitle=""
      menuLabel={menuLabel}
      menuItems={menuItems}
      roleOptions={[]}
      activeRole={activeRole}
      logoutLabel={logoutLabel}
      theme={theme}
      themeLabels={dict.shell.theme}
      roleLabels={{ section: dict.shell.roleSection }}
      languageSwitcher={{ enabled: true, labels: dict.navLanguage }}
      guestLanguageMode={!roles.includes("CUSTOMER")}
      guestLoginLabel={!isLoggedIn ? dict.siteNav.login : undefined}
      guestLoginHref={guestLoginHref}
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
