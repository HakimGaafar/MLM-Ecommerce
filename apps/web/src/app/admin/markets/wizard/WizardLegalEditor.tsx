"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Policy = {
  id: string;
  documentType: string;
  version: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
};

type Labels = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  legalHint: string;
  openLegal: string;
  savePolicy: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  draft: string;
  published: string;
  selectDoc: string;
};

const DOC_ORDER = ["TERMS", "PRIVACY", "RETURNS", "SHIPPING", "PRICING_PAYMENT"] as const;

export default function WizardLegalEditor({
  marketCode,
  labels,
}: {
  marketCode: string;
  labels: Labels;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedType, setSelectedType] = useState<string>("TERMS");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/legal-policies?marketCode=${encodeURIComponent(marketCode)}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as {
        policies?: Policy[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? labels.loadError);
      const rows = (data?.policies ?? []).filter((p) => p.isCurrent);
      setPolicies(rows);
      if (rows.length > 0 && !rows.some((p) => p.documentType === selectedType)) {
        setSelectedType(rows[0]!.documentType);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, marketCode, selectedType, toast]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per market
  }, [marketCode]);

  const current = useMemo(
    () => policies.find((p) => p.documentType === selectedType) ?? null,
    [policies, selectedType],
  );

  function patchCurrent(patch: Partial<Policy>) {
    setPolicies((prev) =>
      prev.map((p) => (p.documentType === selectedType ? { ...p, ...patch } : p)),
    );
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/admin/legal-policies?marketCode=${encodeURIComponent(marketCode)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: current.documentType,
            version: current.version || "1.0",
            titleEn: current.titleEn,
            titleAr: current.titleAr,
            bodyEn: current.bodyEn,
            bodyAr: current.bodyAr,
            setCurrent: true,
            publish: false,
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

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{labels.loading}</p>;
  }

  const types = DOC_ORDER.filter((t) => policies.some((p) => p.documentType === t));

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{labels.legalHint}</p>
      <label className="block space-y-1 text-sm">
        <span>{labels.selectDoc}</span>
        <select
          className="app-input"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          {types.map((t) => {
            const row = policies.find((p) => p.documentType === t);
            return (
              <option key={t} value={t}>
                {t}
                {row?.publishedAt ? ` · ${labels.published}` : ` · ${labels.draft}`}
              </option>
            );
          })}
        </select>
      </label>

      {current ? (
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span>{labels.titleEn}</span>
            <input
              className="app-input"
              value={current.titleEn}
              onChange={(e) => patchCurrent({ titleEn: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{labels.titleAr}</span>
            <input
              className="app-input"
              value={current.titleAr}
              onChange={(e) => patchCurrent({ titleAr: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{labels.bodyEn}</span>
            <textarea
              className="app-input min-h-28"
              value={current.bodyEn ?? ""}
              onChange={(e) => patchCurrent({ bodyEn: e.target.value || null })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{labels.bodyAr}</span>
            <textarea
              className="app-input min-h-28"
              value={current.bodyAr ?? ""}
              onChange={(e) => patchCurrent({ bodyAr: e.target.value || null })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary btn-press text-sm disabled:opacity-50"
              disabled={saving}
              onClick={() => void save()}
            >
              {labels.savePolicy}
            </button>
            <a
              href={`/admin/legal?marketCode=${encodeURIComponent(marketCode)}`}
              className="text-sm text-link font-medium"
            >
              {labels.openLegal}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
