"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { primaryMarketFromCountry } from "@mlm/shared";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Ui = {
  storeName: string;
  countrySection: string;
  country: string;
  countryHint: string;
  primaryMarket: string;
  primaryMarketSA: string;
  primaryMarketOM: string;
  primaryMarketEG: string;
  primaryMarketGLOBAL: string;
  countrySA: string;
  countryOM: string;
  countryEG: string;
  countryOther: string;
  seoSection: string;
  metaTitle: string;
  metaTitleHint: string;
  metaDescription: string;
  metaDescriptionHint: string;
  submit: string;
  submitting: string;
  loading: string;
  loadError: string;
  saveError: string;
};

export default function VendorStoreForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [storeName, setStoreName] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryLabel = useMemo(() => {
    const code = primaryMarketFromCountry(countryCode);
    if (code === "SA") return ui.primaryMarketSA;
    if (code === "OM") return ui.primaryMarketOM;
    if (code === "EG") return ui.primaryMarketEG;
    return ui.primaryMarketGLOBAL;
  }, [countryCode, ui]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/vendor/store", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(ui.loadError);
        const data = (await res.json()) as {
          store: {
            storeName: string;
            countryCode: string;
            metaTitle: string | null;
            metaDescription: string | null;
          };
        };
        if (!cancelled) {
          setStoreName(data.store.storeName);
          setCountryCode(data.store.countryCode || "SA");
          setMetaTitle(data.store.metaTitle ?? "");
          setMetaDescription(data.store.metaDescription ?? "");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ui.loadError]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendor/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          storeName,
          countryCode,
          metaTitle: metaTitle.trim(),
          metaDescription: metaDescription.trim(),
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.saveError);
      }
      toast.success(toastDict.storeSaved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <form className="mt-6 max-w-lg space-y-5" onSubmit={onSubmit} dir={direction}>
      {error ? <p className="app-alert-error">{error}</p> : null}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.storeName}</span>
        <input
          required
          minLength={2}
          maxLength={120}
          className="app-input"
          value={storeName}
          onChange={(ev) => setStoreName(ev.target.value)}
        />
      </label>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))] p-4">
        <h2 className="text-sm font-semibold">{ui.countrySection}</h2>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.country}</span>
          <select
            className="app-input"
            value={["SA", "OM", "EG", "US"].includes(countryCode) ? countryCode : "US"}
            onChange={(ev) => setCountryCode(ev.target.value)}
          >
            <option value="SA">{ui.countrySA}</option>
            <option value="OM">{ui.countryOM}</option>
            <option value="EG">{ui.countryEG}</option>
            <option value="US">{ui.countryOther}</option>
          </select>
          <span className="text-xs text-[var(--muted)]">{ui.countryHint}</span>
        </label>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--surface)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">
            {ui.primaryMarket}
          </p>
          <p className="mt-0.5 text-sm font-medium">{primaryLabel}</p>
        </div>
      </section>

      <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm font-medium">{ui.seoSection}</legend>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.metaTitle}</span>
          <input
            maxLength={70}
            className="app-input"
            value={metaTitle}
            onChange={(ev) => setMetaTitle(ev.target.value)}
          />
          <span className="text-xs text-[var(--muted)]">{ui.metaTitleHint}</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.metaDescription}</span>
          <textarea
            maxLength={160}
            rows={3}
            className="app-input min-h-[4.5rem] resize-y"
            value={metaDescription}
            onChange={(ev) => setMetaDescription(ev.target.value)}
          />
          <span className="text-xs text-[var(--muted)]">{ui.metaDescriptionHint}</span>
        </label>
      </fieldset>

      <button type="submit" disabled={saving} className="btn-primary btn-press w-full">
        {saving ? ui.submitting : ui.submit}
      </button>
    </form>
  );
}
