"use client";

import Link from "next/link";
import Image from "next/image";
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
import { BRAND_LOGO_PATH } from "@/lib/brand";

type Locale = "en" | "ar";

type NavLanguageLabels = {
  label: string;
  shortEn: string;
  shortAr: string;
  error: string;
};

export default function AppHeader({
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
  guestLoginLabel,
  guestLoginHref = "/account/customer",
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
  guestLoginHref?: string;
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
    Boolean(guestLoginLabel) &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname.startsWith("/account/customer"));

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
    router.replace("/");
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
        className="mx-auto flex h-[var(--header-height)] max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6"
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
            className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-bold tracking-tight text-[var(--foreground)] sm:text-base"
          >
            <Image
              src={BRAND_LOGO_PATH}
              alt=""
              width={72}
              height={50}
              priority
              className="h-9 w-auto shrink-0 rounded bg-white object-contain p-0.5"
            />
            <span className="hidden truncate sm:inline">{appName}</span>
          </Link>
          <nav className="hidden min-w-0 max-w-[min(100%,42rem)] flex-1 items-center gap-0.5 overflow-x-auto md:flex lg:max-w-none lg:gap-1">
            {headerLinks.map((link) => {
              const isActive = isShellNavItemActive(pathname, link, headerLinks);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`btn-press whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium transition sm:text-sm lg:px-3 ${
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

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {marketSwitcher ? (
            <MarketSwitcher
              locale={locale}
              activeMarketCode={marketSwitcher.activeMarketCode}
              options={marketSwitcher.options}
              labels={marketSwitcher.labels}
              variant="header"
            />
          ) : null}

          {showLanguage && languageSwitcher ? (
            <div className="hidden sm:block">
              <div
                dir="ltr"
                className={`flex rounded-full bg-[var(--border)] p-0.5 ${langSaving ? "opacity-60" : ""}`}
              >
                <button
                  type="button"
                  disabled={langSaving}
                  aria-label={languageSwitcher.labels.shortEn}
                  onClick={() => void applyLocale("en")}
                  className={`rounded-full px-2 py-1.5 text-[11px] font-semibold leading-tight sm:text-xs ${locale === "en" ? "bg-[var(--primary)] text-white" : ""}`}
                >
                  {languageSwitcher.labels.shortEn}
                </button>
                <button
                  type="button"
                  disabled={langSaving}
                  aria-label={languageSwitcher.labels.shortAr}
                  onClick={() => void applyLocale("ar")}
                  className={`rounded-full px-2 py-1.5 text-[11px] font-semibold leading-tight sm:text-xs ${locale === "ar" ? "bg-[var(--primary)] text-white" : ""}`}
                >
                  {languageSwitcher.labels.shortAr}
                </button>
              </div>
              {langError ? <p className="sr-only">{langError}</p> : null}
            </div>
          ) : null}

          <ThemeToggle theme={theme} labels={{ light: themeLabels.light, dark: themeLabels.dark }} />

          <div className="relative" ref={menuRef}>
            {guestLoginLabel && !hideGuestLogin ? (
              <Link
                href={guestLoginHref}
                className="btn-press inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
              >
                {menuLabel}
              </Link>
            ) : logoutLabel ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((v) => !v)}
                  className="btn-press rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
                >
                  {menuLabel}
                </button>
                {isMenuOpen ? (
                  <div
                    className="absolute z-50 mt-2 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg"
                    style={locale === "ar" ? { left: 0 } : { right: 0 }}
                    dir={direction}
                  >
                    <div className="md:hidden">
                      {headerLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block rounded-lg px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      {showLanguage && languageSwitcher ? (
                        <div className="border-t border-[var(--border)] px-3 py-2 sm:hidden">
                          <span className="mb-1.5 block text-xs text-[var(--muted)]">
                            {languageSwitcher.labels.label}
                          </span>
                          <div dir="ltr" className="flex rounded-full bg-[var(--border)] p-0.5">
                            <button
                              type="button"
                              disabled={langSaving}
                              onClick={() => void applyLocale("en")}
                              className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs font-semibold ${locale === "en" ? "bg-[var(--primary)] text-white" : ""}`}
                            >
                              {languageSwitcher.labels.shortEn}
                            </button>
                            <button
                              type="button"
                              disabled={langSaving}
                              onClick={() => void applyLocale("ar")}
                              className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs font-semibold ${locale === "ar" ? "bg-[var(--primary)] text-white" : ""}`}
                            >
                              {languageSwitcher.labels.shortAr}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
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
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="btn-press block w-full border-t border-[var(--border)] px-3 py-2 text-start text-sm text-red-600 dark:text-red-400"
                    >
                      {logoutLabel}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <Link
                href="/"
                className="btn-press inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium md:hidden"
              >
                {menuLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
