"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { markMarketConfirmed } from "@/lib/market-client";

type Locale = "en" | "ar";

export type MarketPickerUi = {
  title: string;
  subtitle: string;
  suggestedLabel: string;
  continueLabel: string;
  error: string;
  markets: Record<MarketCode, { description: string }>;
};

export type MarketPickerOption = {
  code: MarketCode;
  name: string;
  currency: string;
  description: string;
};

export default function MarketPickerView({
  locale,
  ui,
  options,
  suggestedCode,
}: {
  locale: Locale;
  ui: MarketPickerUi;
  options: MarketPickerOption[];
  suggestedCode: MarketCode;
}) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const initial =
    (searchParams.get("suggested")?.toUpperCase() as MarketCode | null) ?? suggestedCode;
  const [selected, setSelected] = useState<MarketCode>(
    options.some((o) => o.code === initial) ? initial : options[0]?.code ?? "SA",
  );
  const [saving, setSaving] = useState(false);

  async function onContinue() {
    if (saving) return;
    setSaving(true);
    try {
      const returnTo = searchParams.get("returnTo")?.trim() || "/";
      const res = await fetch(
        `/api/v1/market/switch?returnTo=${encodeURIComponent(returnTo)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketCode: selected }),
        },
      );
      const data = (await res.json().catch(() => null)) as { redirectUrl?: string } | null;
      if (!res.ok || !data?.redirectUrl) {
        toast.error(ui.error);
        return;
      }
      toast.success(toastDict.marketSwitched ?? ui.continueLabel);
      markMarketConfirmed();
      window.location.href = data.redirectUrl;
    } catch {
      toast.error(ui.error);
    } finally {
      setSaving(false);
    }
  }

  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14" dir={direction}>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{ui.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">{ui.subtitle}</p>
        {suggestedCode ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {ui.suggestedLabel}: {options.find((o) => o.code === suggestedCode)?.name ?? suggestedCode}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const active = selected === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setSelected(opt.code)}
              className={`rounded-xl border p-4 text-start transition ${
                active
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] ring-2 ring-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--foreground)]">{opt.name}</span>
                <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs font-medium">
                  {opt.currency}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{opt.description}</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void onContinue()}
        className="btn-press mx-auto w-full max-w-sm rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
      >
        {saving ? "…" : ui.continueLabel}
      </button>
    </div>
  );
}
