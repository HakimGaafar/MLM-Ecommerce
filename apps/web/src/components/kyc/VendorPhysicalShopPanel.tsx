"use client";

import { useCallback, useEffect, useState } from "react";

type ListOption = { code: string; labelEn: string; labelAr: string };

type Flags = {
  hasPhysicalShop: boolean;
  hasCommercialLicense: boolean;
  licenseTypeCode: string | null;
  licenseTypeOther: string | null;
  ecommerceOnLicense: boolean;
};

type Ui = {
  title: string;
  body: string;
  yes: string;
  no: string;
  licenseHint: string;
  physicalShopLabel: string;
  commercialLicenseLabel: string;
  licenseTypeLabel: string;
  licenseTypeOtherLabel: string;
  ecommerceOnLicenseLabel: string;
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
  const [flags, setFlags] = useState<Flags | null>(null);
  const [licenseOptions, setLicenseOptions] = useState<ListOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagsRes, listRes] = await Promise.all([
        fetch("/api/v1/vendor/kyc/business-flags", { credentials: "include", cache: "no-store" }),
        fetch("/api/v1/public/vendor-form-lists?listKey=LICENSE_TYPE", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (!flagsRes.ok) throw new Error(ui.loadError);
      const data = (await flagsRes.json()) as Flags;
      setFlags(data);
      if (listRes.ok) {
        const listPayload = (await listRes.json()) as { options?: ListOption[] };
        setLicenseOptions(listPayload.options ?? []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<Flags>) {
    if (!flags || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendor/kyc/business-flags", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await res.json().catch(() => null)) as (Flags & { error?: string }) | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.loadError);
      setFlags(payload as Flags);
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui.loadError);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !flags) {
    return (
      <p dir={direction} className="text-sm text-[var(--muted)]">
        {ui.saving}
      </p>
    );
  }

  return (
    <section
      dir={direction}
      className="space-y-5 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_5%,var(--surface))] p-4"
    >
      <div>
        <h2 className="text-base font-semibold">{ui.title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{ui.body}</p>
        <p className="mt-2 text-xs text-amber-200/90">{ui.licenseHint}</p>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div>
        <p className="text-sm font-medium">{ui.physicalShopLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
              flags.hasPhysicalShop
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "btn-secondary"
            }`}
            onClick={() => void save({ hasPhysicalShop: true })}
          >
            {ui.yes}
          </button>
          <button
            type="button"
            disabled={saving}
            className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
              !flags.hasPhysicalShop
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "btn-secondary"
            }`}
            onClick={() => void save({ hasPhysicalShop: false })}
          >
            {ui.no}
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">{ui.commercialLicenseLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
              flags.hasCommercialLicense
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "btn-secondary"
            }`}
            onClick={() => void save({ hasCommercialLicense: true })}
          >
            {ui.yes}
          </button>
          <button
            type="button"
            disabled={saving}
            className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
              !flags.hasCommercialLicense
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "btn-secondary"
            }`}
            onClick={() =>
              void save({
                hasCommercialLicense: false,
                licenseTypeCode: null,
                licenseTypeOther: null,
                ecommerceOnLicense: false,
              })
            }
          >
            {ui.no}
          </button>
        </div>
      </div>

      {flags.hasCommercialLicense ? (
        <>
          <label className="block text-sm">
            <span className="font-medium">{ui.licenseTypeLabel}</span>
            <select
              className="app-input mt-1"
              value={flags.licenseTypeCode ?? ""}
              disabled={saving}
              onChange={(e) =>
                void save({
                  licenseTypeCode: e.target.value || null,
                  licenseTypeOther: e.target.value === "OTHER" ? flags.licenseTypeOther : null,
                })
              }
            >
              <option value="">—</option>
              {licenseOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {locale === "ar" ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>
          {flags.licenseTypeCode === "OTHER" ? (
            <label className="block text-sm">
              <span className="font-medium">{ui.licenseTypeOtherLabel}</span>
              <input
                className="app-input mt-1"
                value={flags.licenseTypeOther ?? ""}
                disabled={saving}
                onBlur={(e) => void save({ licenseTypeOther: e.target.value.trim() || null })}
                onChange={(e) =>
                  setFlags((prev) =>
                    prev ? { ...prev, licenseTypeOther: e.target.value } : prev,
                  )
                }
              />
            </label>
          ) : null}
          <div>
            <p className="text-sm font-medium">{ui.ecommerceOnLicenseLabel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
                  flags.ecommerceOnLicense
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "btn-secondary"
                }`}
                onClick={() => void save({ ecommerceOnLicense: true })}
              >
                {ui.yes}
              </button>
              <button
                type="button"
                disabled={saving}
                className={`btn-press rounded-lg px-4 py-2 text-sm font-medium ${
                  !flags.ecommerceOnLicense
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "btn-secondary"
                }`}
                onClick={() => void save({ ecommerceOnLicense: false })}
              >
                {ui.no}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
