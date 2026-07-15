"use client";

import type { ReactNode } from "react";
import { useAppLocale } from "@/components/providers/LocaleProvider";

export default function VendorProductPageLayout({ children }: { children: ReactNode }) {
  const locale = useAppLocale();
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="mx-auto w-full max-w-4xl p-8 animate-page-enter" dir={direction}>
      {children}
    </main>
  );
}
