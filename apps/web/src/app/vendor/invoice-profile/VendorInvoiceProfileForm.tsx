"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Ui = {
  legalName: string;
  vatTrnRegistered: string;
  vatTrn: string;
  vatTrnHint: string;
  vatPercent: string;
  vatPercentHint: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  countryCode: string;
  logoUrl: string;
  logoUrlHint: string;
  submit: string;
  submitting: string;
  loading: string;
  loadError: string;
  saveError: string;
  completeHint: string;
};

export default function VendorInvoiceProfileForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [legalName, setLegalName] = useState("");
  const [vatTrn, setVatTrn] = useState("");
  const [vatPercent, setVatPercent] = useState("");
  const [hasVatTrn, setHasVatTrn] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [logoUrl, setLogoUrl] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/vendor/invoice-profile", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(ui.loadError);
        const data = (await res.json()) as {
          profile: {
            legalName: string;
            vatTrn: string | null;
            vatPercent: number | null;
            addressLine1: string;
            addressLine2: string | null;
            city: string;
            postalCode: string;
            countryCode: string;
            logoUrl: string | null;
            complete: boolean;
          };
        };
        if (!cancelled) {
          setLegalName(data.profile.legalName);
          setVatTrn(data.profile.vatTrn ?? "");
          setVatPercent(data.profile.vatPercent != null ? String(data.profile.vatPercent) : "");
          setHasVatTrn(
            Boolean(
              (data.profile.vatTrn && data.profile.vatTrn.trim().length > 0) ||
                data.profile.vatPercent != null,
            ),
          );
          setAddressLine1(data.profile.addressLine1);
          setAddressLine2(data.profile.addressLine2 ?? "");
          setCity(data.profile.city);
          setPostalCode(data.profile.postalCode);
          setCountryCode(data.profile.countryCode);
          setLogoUrl(data.profile.logoUrl ?? "");
          setComplete(data.profile.complete);
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
      const res = await fetch("/api/v1/vendor/invoice-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          legalName,
          vatTrn: hasVatTrn ? vatTrn.trim() || null : null,
          vatPercent: hasVatTrn ? Number.parseFloat(vatPercent) : null,
          addressLine1,
          addressLine2: addressLine2.trim() || null,
          city,
          postalCode,
          countryCode: countryCode.toUpperCase(),
          logoUrl: logoUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.saveError);
      }
      const data = (await res.json()) as { profile: { complete: boolean } };
      setComplete(data.profile.complete);
      toast.success(toastDict.invoiceProfileSaved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-(--muted)">{ui.loading}</p>;
  }

  return (
    <form className="mt-6 max-w-lg space-y-4" onSubmit={onSubmit} dir={direction}>
      {error ? <p className="app-alert-error">{error}</p> : null}
      {!complete ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          {ui.completeHint}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.legalName}</span>
        <input required minLength={2} maxLength={200} className="app-input" value={legalName} onChange={(ev) => setLegalName(ev.target.value)} />
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm" dir={direction}>
        <input
          type="checkbox"
          className="mt-1 rounded border-(--border-strong)"
          checked={hasVatTrn}
          onChange={(ev) => {
            const next = ev.target.checked;
            setHasVatTrn(next);
            if (!next) {
              setVatTrn("");
              setVatPercent("");
            }
          }}
        />
        <span className="pt-0.5">{ui.vatTrnRegistered}</span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.vatTrn}</span>
        <input
          minLength={5}
          maxLength={32}
          className="app-input"
          value={vatTrn}
          onChange={(ev) => setVatTrn(ev.target.value)}
          disabled={!hasVatTrn}
          required={hasVatTrn}
        />
        <span className="text-xs text-(--muted)">{ui.vatTrnHint}</span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.vatPercent}</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          inputMode="decimal"
          className="app-input"
          value={vatPercent}
          onChange={(ev) => setVatPercent(ev.target.value)}
          disabled={!hasVatTrn}
          required={hasVatTrn}
        />
        <span className="text-xs text-(--muted)">{ui.vatPercentHint}</span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.addressLine1}</span>
        <input required minLength={3} maxLength={200} className="app-input" value={addressLine1} onChange={(ev) => setAddressLine1(ev.target.value)} />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.addressLine2}</span>
        <input maxLength={200} className="app-input" value={addressLine2} onChange={(ev) => setAddressLine2(ev.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.city}</span>
          <input required minLength={2} maxLength={120} className="app-input" value={city} onChange={(ev) => setCity(ev.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.postalCode}</span>
          <input required minLength={2} maxLength={20} className="app-input" value={postalCode} onChange={(ev) => setPostalCode(ev.target.value)} />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.countryCode}</span>
        <input required minLength={2} maxLength={2} className="app-input uppercase" value={countryCode} onChange={(ev) => setCountryCode(ev.target.value.toUpperCase())} />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.logoUrl}</span>
        <input type="url" maxLength={500} className="app-input" value={logoUrl} onChange={(ev) => setLogoUrl(ev.target.value)} />
        <span className="text-xs text-(--muted)">{ui.logoUrlHint}</span>
      </label>

      <button type="submit" className="btn-primary btn-press" disabled={saving}>
        {saving ? ui.submitting : ui.submit}
      </button>
    </form>
  );
}
