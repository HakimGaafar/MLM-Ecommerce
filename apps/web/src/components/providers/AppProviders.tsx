"use client";

import { LocaleProvider, useAppLocale } from "@/components/providers/LocaleProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import type { ReactNode } from "react";

function ToastLocaleBridge({ children }: { children: ReactNode }) {
  const locale = useAppLocale();
  return <ToastProvider locale={locale}>{children}</ToastProvider>;
}

export default function AppProviders({
  children,
  locale,
  guestLanguageMode,
}: {
  children: ReactNode;
  locale: "en" | "ar";
  guestLanguageMode: boolean;
}) {
  return (
    <LocaleProvider initialLocale={locale} guestLanguageMode={guestLanguageMode}>
      <ToastLocaleBridge>{children}</ToastLocaleBridge>
    </LocaleProvider>
  );
}
