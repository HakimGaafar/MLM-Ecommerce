"use client";

import { useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { markMarketConfirmed } from "@/lib/market-client";

type Locale = "en" | "ar";

export type MarketSwitcherLabels = {
  label: string;
  current: string;
  error: string;
  markets: Record<MarketCode, string>;
};

export type MarketOption = {
  code: MarketCode;
  label: string;
  currency: string;
};

export default function MarketSwitcher({
  locale,
  activeMarketCode,
  options,
  labels,
}: {
  locale: Locale;
  activeMarketCode: MarketCode;
  options: MarketOption[];
  labels: MarketSwitcherLabels;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [saving, setSaving] = useState(false);

  async function onChange(next: MarketCode) {
    if (next === activeMarketCode || saving) return;
    setSaving(true);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const res = await fetch(
        `/api/v1/market/switch?returnTo=${encodeURIComponent(returnTo)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketCode: next }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.redirectUrl) {
        toast.error(labels.error);
        return;
      }
      toast.success(toastDict.marketSwitched ?? labels.current);
      markMarketConfirmed();
      window.location.href = data.redirectUrl;
    } catch {
      toast.error(labels.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-[var(--border)] px-3 py-2">
      <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="market-switcher">
        {labels.label}
      </label>
      <select
        id="market-switcher"
        disabled={saving}
        value={activeMarketCode}
        onChange={(e) => void onChange(e.target.value as MarketCode)}
        className="app-input w-full text-sm"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label} ({opt.currency})
          </option>
        ))}
      </select>
    </div>
  );
}
