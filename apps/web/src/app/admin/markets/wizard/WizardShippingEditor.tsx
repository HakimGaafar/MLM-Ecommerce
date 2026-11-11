"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Rate = {
  code: string;
  amount: string | number;
  currency: string;
  perUnit: boolean;
  isActive: boolean;
};

type Labels = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  shippingHint: string;
  amount: string;
  active: string;
  saveRate: string;
  empty: string;
};

export default function WizardShippingEditor({
  marketCode,
  labels,
}: {
  marketCode: string;
  labels: Labels;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/shipping/rates?marketCode=${encodeURIComponent(marketCode)}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as {
        rates?: Rate[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? labels.loadError);
      setRates(data?.rates ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [labels.loadError, marketCode, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRate(rate: Rate) {
    setSavingCode(rate.code);
    try {
      const res = await fetch("/api/v1/admin/shipping/rates", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketCode,
          code: rate.code,
          amount: Number(rate.amount),
          perUnit: rate.perUnit,
          isActive: rate.isActive,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? labels.saveError);
      toast.success(labels.saved);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.saveError);
    } finally {
      setSavingCode(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{labels.loading}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{labels.shippingHint}</p>
      {rates.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{labels.empty}</p>
      ) : (
        <div className="space-y-2">
          {rates.map((rate) => (
            <div
              key={rate.code}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] p-3"
            >
              <div className="min-w-[8rem] flex-1">
                <p className="text-sm font-medium">{rate.code}</p>
                <p className="text-xs text-[var(--muted)]">{rate.currency}</p>
              </div>
              <label className="block space-y-1 text-sm">
                <span>{labels.amount}</span>
                <input
                  className="app-input w-28"
                  value={String(rate.amount)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRates((prev) =>
                      prev.map((row) =>
                        row.code === rate.code ? { ...row, amount: value } : row,
                      ),
                    );
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={rate.isActive}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRates((prev) =>
                      prev.map((row) =>
                        row.code === rate.code ? { ...row, isActive: checked } : row,
                      ),
                    );
                  }}
                />
                {labels.active}
              </label>
              <button
                type="button"
                className="btn-secondary btn-press text-xs disabled:opacity-50"
                disabled={savingCode === rate.code}
                onClick={() => void saveRate(rate)}
              >
                {labels.saveRate}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
