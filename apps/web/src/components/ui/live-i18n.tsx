"use client";

import { useAppLocale } from "@/components/providers/LocaleProvider";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";

/** Resolve UI copy from the live app locale (not a stale server prop). */
export function useLiveCopy<T extends "contactPage" | "login" | "register" | "sellOnboarding">(
  section: T,
): (typeof en)[T] {
  const locale = useAppLocale();
  return (locale === "ar" ? ar : en)[section];
}

export function useLiveLocale() {
  return useAppLocale();
}

/** Keep `lang`/`dir` correct so English leftovers don't render RTL punctuation. */
export function LocalizedFieldError({
  id,
  message,
}: {
  id?: string;
  message?: string | null;
}) {
  const locale = useAppLocale();
  if (!message) return null;
  return (
    <p
      id={id}
      className="app-field-error"
      role="alert"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {message}
    </p>
  );
}
