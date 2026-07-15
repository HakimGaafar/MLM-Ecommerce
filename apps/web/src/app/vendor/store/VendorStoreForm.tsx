"use client";

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Ui = {
  storeName: string;
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
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/vendor/store", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(ui.loadError);
        const data = (await res.json()) as {
          store: {
            storeName: string;
            metaTitle: string | null;
            metaDescription: string | null;
          };
        };
        if (!cancelled) {
          setStoreName(data.store.storeName);
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
    <form className="mt-6 max-w-md space-y-4" onSubmit={onSubmit} dir={direction}>
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
