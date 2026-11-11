"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Issuer = {
  legalNameEn: string;
  legalNameAr: string;
  commercialRegistration: string | null;
  unifiedNumber: string | null;
  addressLine1: string;
  city: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
};

type Labels = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saveAnnex: string;
  legalNameEn: string;
  legalNameAr: string;
  cr: string;
  unifiedNumber: string;
  address: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  annexHint: string;
  openAnnex: string;
};

export default function WizardAnnexEditor({
  marketCode,
  labels,
}: {
  marketCode: string;
  labels: Labels;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuer, setIssuer] = useState<Issuer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/markets/annex?marketCode=${encodeURIComponent(marketCode)}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as {
        annex?: { issuer: Issuer | null };
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? labels.loadError);
      setIssuer(
        data?.annex?.issuer ?? {
          legalNameEn: "",
          legalNameAr: "",
          commercialRegistration: null,
          unifiedNumber: null,
          addressLine1: "",
          city: "",
          countryCode: marketCode.length === 2 ? marketCode : "OM",
          phone: null,
          email: null,
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, marketCode, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!issuer) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/admin/markets/annex?marketCode=${encodeURIComponent(marketCode)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalNameEn: issuer.legalNameEn,
            legalNameAr: issuer.legalNameAr,
            commercialRegistration: issuer.commercialRegistration,
            unifiedNumber: issuer.unifiedNumber,
            addressLine1: issuer.addressLine1,
            city: issuer.city,
            countryCode: issuer.countryCode,
            phone: issuer.phone,
            email: issuer.email,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? labels.saveError);
      toast.success(labels.saved);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !issuer) {
    return <p className="text-sm text-[var(--muted)]">{labels.loading}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{labels.annexHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["legalNameEn", labels.legalNameEn],
            ["legalNameAr", labels.legalNameAr],
            ["commercialRegistration", labels.cr],
            ["unifiedNumber", labels.unifiedNumber],
            ["addressLine1", labels.address],
            ["city", labels.city],
            ["countryCode", labels.countryCode],
            ["phone", labels.phone],
            ["email", labels.email],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1 text-sm">
            <span>{label}</span>
            <input
              className="app-input"
              value={(issuer[key] as string | null) ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setIssuer((prev) =>
                  prev
                    ? {
                        ...prev,
                        [key]:
                          key === "commercialRegistration" ||
                          key === "unifiedNumber" ||
                          key === "phone" ||
                          key === "email"
                            ? value || null
                            : key === "countryCode"
                              ? value.toUpperCase()
                              : value,
                      }
                    : prev,
                );
              }}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary btn-press text-sm disabled:opacity-50"
          disabled={saving}
          onClick={() => void save()}
        >
          {labels.saveAnnex}
        </button>
        <a
          href={`/admin/legal?marketCode=${encodeURIComponent(marketCode)}`}
          className="text-sm text-link font-medium"
        >
          {labels.openAnnex}
        </a>
      </div>
    </div>
  );
}
