"use client";

import { useCallback, useEffect, useState } from "react";

type Ui = {
  title: string;
  body: string;
  yes: string;
  no: string;
  licenseHint: string;
  saving: string;
  loadError: string;
};

export default function VendorPhysicalShopPanel({
  locale,
  ui,
  onUpdated,
}: {
  locale: "en" | "ar";
  ui: Ui;
  onUpdated: () => void;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [hasPhysicalShop, setHasPhysicalShop] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendor/kyc/business-flags", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { hasPhysicalShop: boolean };
      setHasPhysicalShop(data.hasPhysicalShop);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateFlag(next: boolean) {
    if (saving || hasPhysicalShop === next) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendor/kyc/business-flags", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasPhysicalShop: next }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.loadError);
      setHasPhysicalShop(next);
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.loadError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p dir={direction} className="text-sm text-[var(--muted)]">
        {ui.saving}
      </p>
    );
  }

  return (
    <section
      dir={direction}
      className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))] p-4"
    >
      <h2 className="text-base font-semibold">{ui.title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{ui.body}</p>
      <p className="mt-2 text-xs text-amber-200/90">{ui.licenseHint}</p>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
            hasPhysicalShop ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "btn-secondary"
          }`}
          onClick={() => void updateFlag(true)}
        >
          {ui.yes}
        </button>
        <button
          type="button"
          disabled={saving}
          className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
            hasPhysicalShop === false ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "btn-secondary"
          }`}
          onClick={() => void updateFlag(false)}
        >
          {ui.no}
        </button>
      </div>
    </section>
  );
}
