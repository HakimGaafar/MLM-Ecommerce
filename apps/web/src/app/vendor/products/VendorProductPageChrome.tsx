"use client";

import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useAppLocale } from "@/components/providers/LocaleProvider";

export default function VendorProductPageChrome({ mode }: { mode: "create" | "edit" }) {
  const locale = useAppLocale();
  const ui = (locale === "ar" ? ar : en).vendorProducts;

  return (
    <div className="mb-0 flex flex-wrap items-baseline justify-between gap-4">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        {mode === "create" ? ui.newTitle : ui.editTitle}
      </h1>
      <Link href="/vendor/products" className="text-sm font-medium text-[var(--primary)] hover:underline">
        {ui.cancelBack}
      </Link>
    </div>
  );
}
