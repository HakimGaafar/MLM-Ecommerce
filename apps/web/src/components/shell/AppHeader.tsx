"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ThemePreference } from "@/lib/theme-preference";
import type { AppRole } from "@/lib/server-session";
import { isShellNavItemActive, type ShellNavItem } from "@/lib/build-app-nav";
import { useAppLocale, useSetAppLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/toast/ToastProvider";
import MarketSwitcher, {
  type MarketOption,
  type MarketSwitcherLabels,
} from "@/components/shell/MarketSwitcher";
import type { MarketCode } from "@mlm/shared";
import { getToastDict } from "@/lib/toast-messages";
import ThemeToggle from "@/components/shell/ThemeToggle";

type Locale = "en" | "ar";

type NavLanguageLabels = {
  label: string;
  shortEn: string;
  shortAr: string;
  error: string;
};

export default function AppHeader({
  locale: _serverLocale,
  appName,
  headerLinks,
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
  onMenuToggle,
  showMenuButton,
}: {
  locale: Locale;
  appName: string;
  headerLinks: ShellNavItem[];
  menuLabel: string;
  menuItems: ShellNavItem[];
  roleOptions: { role: AppRole; label: string }[];
  activeRole: AppRole | null;
  logoutLabel?: string;
  theme: ThemePreference;
  themeLabels: { section: string; light: string; dark: string };
  roleLabels: { section: string };
  languageSwitcher?: { enabled: boolean; labels: NavLanguageLabels };
  guestLanguageMode?: boolean;
  guestLoginLabel?: string;
  marketSwitcher?: {
    activeMarketCode: MarketCode;
    options: MarketOption[];
    labels: MarketSwitcherLabels;
  };
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useAppLocale();
  const setAppLocale = useSetAppLocale();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [langSaving, setLangSaving] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);

  const showLanguage = languageSwitcher?.enabled === true;
  const hideGuestLogin =
    Boolean(guestLoginLabel) && (pathname === "/login" || pathname === "/register");

  useEffect(() => {
    if (!isMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isMenuOpen]);

  async function handleLogout() {
    setIsMenuOpen(false);
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    toast.success(toastDict.loggedOut);
    router.replace("/login");
    router.refresh();
  }

  async function applyLocale(next: Locale) {
    if (!languageSwitcher?.enabled || next === locale || langSaving) return;
    setLangSaving(true);
    setLangError(null);
    try {
      await setAppLocale(next);
      toast.success(toastDict.languageUpdated);
    } catch {
      setLangError(languageSwitcher.labels.error);
      toast.error(toastDict.languageUpdateFailed);
    } finally {
      setLangSaving(false);
    }
  }

  async function switchRole(role: AppRole) {
    setIsMenuOpen(false);
    const res = await fetch("/api/v1/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeRole: role }),
    });
    if (res.ok) {
      toast.success(toastDict.roleSwitched);
      router.replace("/dashboard");
    } else {
      toast.error(toastDict.genericError);
    }
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md"
      style={{ minHeight: "var(--header-height)" }}
    >
      <div
        className="mx-auto flex h-[var(--header-height)] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6"
        dir={direction}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {showMenuButton ? (
            <button
              type="button"
              onClick={onMenuToggle}
              className="btn-press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] lg:hidden"
              aria-label="Menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : null}
          <Link
            href="/"
            className="truncate text-sm font-bold tracking-tight text-[var(--foreground)] sm:text-base"
          >
            {appName}
          </Link>
          {marketSwitcher ? (
            <span className="hidden shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:inline">
              {marketSwitcher.options.find((o) => o.code === marketSwitcher.activeMarketCode)?.currency ??
                marketSwitcher.activeMarketCode}
            </span>
          ) : null}
          <nav className="hidden items-center gap-1 md:flex">
            {headerLinks.map((link) => {
              const isActive = isShellNavItemActive(pathname, link, headerLinks);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`btn-press rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="btn-press rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
            >
              {menuLabel}
            </button>
            {isMenuOpen ? (
              <div
                className="absolute z-50 mt-2 min-w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg"
                style={locale === "ar" ? { left: 0 } : { right: 0 }}
                dir={direction}
              >
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}

                <div
                  className={
                    menuItems.length > 0 ? "border-t border-[var(--border)] px-3 py-2" : "px-3 py-2"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--muted)]">{themeLabels.section}</span>
                    <ThemeToggle
                      theme={theme}
                      labels={{ light: themeLabels.light, dark: themeLabels.dark }}
                    />
                  </div>
                </div>

                {roleOptions.length > 1 ? (
                  <div className="border-t border-[var(--border)] px-3 py-2">
                    <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">{roleLabels.section}</p>
                    <div className="flex flex-col gap-1">
                      {roleOptions.map((opt) => (
                        <button
                          key={opt.role}
                          type="button"
                          onClick={() => void switchRole(opt.role)}
                          className={`btn-press rounded-md px-2 py-1.5 text-start text-sm ${
                            activeRole === opt.role
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {marketSwitcher ? (
                  <MarketSwitcher
                    locale={locale}
                    activeMarketCode={marketSwitcher.activeMarketCode}
                    options={marketSwitcher.options}
                    labels={marketSwitcher.labels}
                  />
                ) : null}

                {showLanguage && languageSwitcher ? (
                  <div className="border-t border-[var(--border)] px-3 py-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="shrink-0 text-xs text-[var(--muted)]">{languageSwitcher.labels.label}</span>
                      <div
                        dir="ltr"
                        className={`flex w-full min-w-0 sm:max-w-[16rem] sm:flex-1 rounded-full bg-[var(--border)] p-0.5 ${langSaving ? "opacity-60" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={langSaving}
                          onClick={() => void applyLocale("en")}
                          className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold leading-tight sm:text-xs ${locale === "en" ? "bg-[var(--primary)] text-white" : ""}`}
                        >
                          {languageSwitcher.labels.shortEn}
                        </button>
                        <button
                          type="button"
                          disabled={langSaving}
                          onClick={() => void applyLocale("ar")}
                          className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold leading-tight sm:text-xs ${locale === "ar" ? "bg-[var(--primary)] text-white" : ""}`}
                        >
                          {languageSwitcher.labels.shortAr}
                        </button>
                      </div>
                    </div>
                    {langError ? <p className="mt-1 text-xs text-red-500">{langError}</p> : null}
                  </div>
                ) : null}

                {guestLoginLabel && !hideGuestLogin ? (
                  <Link
                    href="/login"
                    className="block border-t border-[var(--border)] px-3 py-2 text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {guestLoginLabel}
                  </Link>
                ) : null}

                {logoutLabel ? (
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="btn-press block w-full border-t border-[var(--border)] px-3 py-2 text-start text-sm text-red-600 dark:text-red-400"
                  >
                    {logoutLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
        </div>
      </div>
    </header>
  );
}
