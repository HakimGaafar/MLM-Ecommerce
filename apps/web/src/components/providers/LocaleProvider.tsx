"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { AppLocale } from "@/lib/locale-shared";

export type { AppLocale } from "@/lib/locale-shared";

type LocaleContextValue = {
  locale: AppLocale;
  /** Optimistic UI locale; persists via API then refreshes server components. */
  setLocale: (next: AppLocale, options?: { guestOnly?: boolean }) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useAppLocale(): AppLocale {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within LocaleProvider");
  }
  return ctx.locale;
}

export function useSetAppLocale(): LocaleContextValue["setLocale"] {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useSetAppLocale must be used within LocaleProvider");
  }
  return ctx.setLocale;
}

export function LocaleProvider({
  initialLocale,
  guestLanguageMode,
  children,
}: {
  initialLocale: AppLocale;
  /** Logged-in user without CUSTOMER role — only guest cookie API is allowed. */
  guestLanguageMode: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const setLocale = useCallback(
    async (next: AppLocale, options?: { guestOnly?: boolean }) => {
      if (next === locale) return;

      const guestOnly = options?.guestOnly ?? guestLanguageMode;

      if (guestOnly) {
        const res = await fetch("/api/v1/guest/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        if (!res.ok) throw new Error("LOCALE_SAVE_FAILED");
      } else {
        const res = await fetch("/api/v1/customer/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ preferredLanguage: next }),
        });
        if (!res.ok) throw new Error("LOCALE_SAVE_FAILED");
      }

      // Update UI only after persistence — avoids category fetches reading the old cookie.
      setLocaleState(next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      router.refresh();
    },
    [guestLanguageMode, locale, router],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
