"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { isShellNavItemActive } from "@/lib/build-app-nav";

type Locale = "en" | "ar";

type NavLink = {
  href: string;
  label: string;
  activeMatchStartsWith?: boolean;
};

type MenuItem = {
  href: string;
  label: string;
};

type NavLanguageLabels = {
  label: string;
  shortEn: string;
  shortAr: string;
  error: string;
};

export default function AppNavbar({
  locale,
  links,
  menuLabel,
  menuItems,
  logoutLabel,
  logoutRedirect = "/login",
  containerClassName = "mx-auto w-full max-w-5xl",
  languageSwitcher,
  guestLanguageMode = false,
  guestLoginLabel,
}: {
  locale: Locale;
  links: NavLink[];
  menuLabel: string;
  menuItems: MenuItem[];
  logoutLabel?: string;
  logoutRedirect?: string;
  containerClassName?: string;
  languageSwitcher?: {
    enabled: boolean;
    labels: NavLanguageLabels;
  };
  guestLanguageMode?: boolean;
  guestLoginLabel?: string;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [langSaving, setLangSaving] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);

  const showLanguage = languageSwitcher?.enabled === true;
  const hideGuestLogin =
    Boolean(guestLoginLabel) && (pathname === "/login" || pathname === "/register");

  useEffect(() => {
    if (!isMenuOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuContainerRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isMenuOpen]);

  async function handleLogout() {
    setIsMenuOpen(false);
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    toast.success(toastDict.loggedOut);
    router.replace(logoutRedirect);
    router.refresh();
  }

  async function applyLocale(next: Locale) {
    if (!languageSwitcher?.enabled || next === locale || langSaving) return;
    setLangSaving(true);
    setLangError(null);
    try {
      if (guestLanguageMode) {
        const response = await fetch("/api/v1/guest/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        if (!response.ok) {
          throw new Error(languageSwitcher.labels.error);
        }
      } else {
        const response = await fetch("/api/v1/customer/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ preferredLanguage: next }),
        });
        if (!response.ok) {
          throw new Error(languageSwitcher.labels.error);
        }
      }
      toast.success(toastDict.languageUpdated);
      router.refresh();
    } catch {
      setLangError(languageSwitcher.labels.error);
      toast.error(toastDict.languageUpdateFailed);
    } finally {
      setLangSaving(false);
    }
  }

  const hasDropdownExtras =
    showLanguage || menuItems.length > 0 || logoutLabel || (guestLoginLabel && !hideGuestLogin);

  const menuDivider =
    menuItems.length > 0 || showLanguage || (guestLoginLabel && !hideGuestLogin);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
      <div className={`${containerClassName} flex items-center justify-between gap-4 px-6 py-3`} dir={direction}>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const isActive = isShellNavItemActive(pathname, link, links);

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

        <div className="relative" ref={menuContainerRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="btn-press rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium"
          >
            {menuLabel}
          </button>

          {isMenuOpen ? (
            <div
              className={`absolute z-50 mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg ${hasDropdownExtras ? "min-w-56" : "min-w-44"}`}
              style={locale === "ar" ? { left: 0 } : { right: 0 }}
              dir={direction}
            >
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              {showLanguage && languageSwitcher ? (
                <div
                  className={`px-3 py-2.5 ${menuItems.length > 0 ? "border-t border-[var(--border)]" : ""}`}
                >
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="shrink-0 text-xs font-medium text-[var(--muted)]">{languageSwitcher.labels.label}</span>
                    <div
                      dir="ltr"
                      className={`flex w-full min-w-0 sm:max-w-[16rem] sm:flex-1 rounded-full bg-[var(--border)] p-0.5 transition-opacity ${langSaving ? "pointer-events-none opacity-60" : ""}`}
                      aria-busy={langSaving}
                    >
                      <button
                        type="button"
                        disabled={langSaving}
                        onClick={() => void applyLocale("en")}
                        className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold leading-tight sm:text-xs ${locale === "en" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)]"}`}
                      >
                        {languageSwitcher.labels.shortEn}
                      </button>
                      <button
                        type="button"
                        disabled={langSaving}
                        onClick={() => void applyLocale("ar")}
                        className={`min-w-0 flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold leading-tight sm:text-xs ${locale === "ar" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)]"}`}
                      >
                        {languageSwitcher.labels.shortAr}
                      </button>
                    </div>
                  </div>
                  {langError ? <p className="mt-2 text-xs text-red-500">{langError}</p> : null}
                </div>
              ) : null}

              {guestLoginLabel && !hideGuestLogin ? (
                <Link
                  href="/login"
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${menuDivider ? "border-t border-[var(--border)]" : ""}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {guestLoginLabel}
                </Link>
              ) : null}

              {logoutLabel ? (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className={`btn-press block w-full rounded-lg px-3 py-2 text-start text-sm text-red-600 dark:text-red-400 ${menuDivider ? "border-t border-[var(--border)]" : ""}`}
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
