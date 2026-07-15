"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { shouldShowAppSidebar } from "@/lib/app-paths";
import type { ThemePreference } from "@/lib/theme-preference";
import type { AppRole } from "@/lib/server-session";
import type { ShellNavItem, ShellNavSection } from "@/lib/build-app-nav";
import AppHeader from "@/components/shell/AppHeader";
import AppSidebar from "@/components/shell/AppSidebar";
import type { MarketOption, MarketSwitcherLabels } from "@/components/shell/MarketSwitcher";
import type { MarketCode } from "@mlm/shared";

type Locale = "en" | "ar";

export default function AppShell({
  children,
  locale,
  appName,
  isLoggedIn,
  headerLinks,
  sidebarLinks,
  sidebarSections,
  sidebarTitle,
  menuLabel,
  menuItems,
  roleOptions,
  activeRole,
  logoutLabel,
  theme,
  themeLabels,
  roleLabels,
  languageSwitcher,
  guestLanguageMode,
  guestLoginLabel,
  marketSwitcher,
}: {
  children: ReactNode;
  locale: Locale;
  appName: string;
  isLoggedIn: boolean;
  headerLinks: ShellNavItem[];
  sidebarLinks: ShellNavItem[];
  sidebarSections?: ShellNavSection[];
  sidebarTitle: string;
  menuLabel: string;
  menuItems: ShellNavItem[];
  roleOptions: { role: AppRole; label: string }[];
  activeRole: AppRole | null;
  logoutLabel?: string;
  theme: ThemePreference;
  themeLabels: { section: string; light: string; dark: string };
  roleLabels: { section: string };
  languageSwitcher?: {
    enabled: boolean;
    labels: { label: string; shortEn: string; shortAr: string; error: string };
  };
  guestLanguageMode?: boolean;
  guestLoginLabel?: string;
  marketSwitcher?: {
    activeMarketCode: MarketCode;
    options: MarketOption[];
    labels: MarketSwitcherLabels;
  };
}) {
  const pathname = usePathname() ?? "/";
  const showSidebar = shouldShowAppSidebar(pathname, isLoggedIn) && sidebarLinks.length > 0;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader
        locale={locale}
        appName={appName}
        headerLinks={headerLinks}
        menuLabel={menuLabel}
        menuItems={menuItems}
        roleOptions={roleOptions}
        activeRole={activeRole}
        logoutLabel={logoutLabel}
        theme={theme}
        themeLabels={themeLabels}
        roleLabels={roleLabels}
        languageSwitcher={languageSwitcher}
        guestLanguageMode={guestLanguageMode}
        guestLoginLabel={guestLoginLabel}
        marketSwitcher={marketSwitcher}
        showMenuButton={showSidebar}
        onMenuToggle={() => setMobileNavOpen((v) => !v)}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0">
        {showSidebar ? (
          <AppSidebar
            locale={locale}
            title={sidebarTitle}
            items={sidebarLinks}
            sections={sidebarSections}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
        ) : null}

        <main className="min-w-0 flex-1 animate-page-enter bg-[var(--main-canvas)]">{children}</main>
      </div>
    </div>
  );
}
