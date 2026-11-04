"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "ar";

type FxRateRow = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  source: string;
  effectiveAt: string;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  from: string;
  to: string;
  rate: string;
  effectiveAt: string;
  source: string;
  addTitle: string;
  save: string;
  saving: string;
  saveError: string;
  saved: string;
  refresh: string;
};

export default function AdminFxRatesPanel({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const [rates, setRates] = useState<FxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fromCurrency, setFromCurrency] = useState("SAR");
  const [toCurrency, setToCurrency] = useState("AED");
  const [rate, setRate] = useState("0.98");
  const [effectiveAt, setEffectiveAt] = useState("");

  async function loadRates() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/fx-rates?limit=100", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { rates: FxRateRow[] };
      setRates(data.rates);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/admin/fx-rates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          rate: Number(rate),
          ...(effectiveAt ? { effectiveAt: new Date(effectiveAt).toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? ui.saveError);
      }
      setMessage(ui.saved);
      await loadRates();
    } catch (err) {
      setError(err instanceof Error ? err.message : ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "ar" ? "ar" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => void handleSave(e)}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          {ui.addTitle}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.from}</span>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 uppercase"
              value={fromCurrency}
              maxLength={3}
              onChange={(e) => setFromCurrency(e.target.value.toUpperCase())}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.to}</span>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 uppercase"
              value={toCurrency}
              maxLength={3}
              onChange={(e) => setToCurrency(e.target.value.toUpperCase())}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.rate}</span>
            <input
              type="number"
              step="any"
              min="0"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.effectiveAt}</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving}>
            {saving ? ui.saving : ui.save}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void loadRates()}>
            {ui.refresh}
          </button>
          {message ? <span className="text-sm text-emerald-700 dark:text-emerald-400">{message}</span> : null}
          {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        {loading ? (
          <p className="p-6 text-sm text-[var(--muted)]">{ui.loading}</p>
        ) : rates.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">{ui.empty}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.from}</th>
                <th className="px-4 py-3 font-medium">{ui.to}</th>
                <th className="px-4 py-3 font-medium">{ui.rate}</th>
                <th className="px-4 py-3 font-medium">{ui.source}</th>
                <th className="px-4 py-3 font-medium">{ui.effectiveAt}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono">{row.fromCurrency}</td>
                  <td className="px-4 py-3 font-mono">{row.toCurrency}</td>
                  <td className="px-4 py-3 tabular-nums">{row.rate}</td>
                  <td className="px-4 py-3">{row.source}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{dateFmt(row.effectiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
