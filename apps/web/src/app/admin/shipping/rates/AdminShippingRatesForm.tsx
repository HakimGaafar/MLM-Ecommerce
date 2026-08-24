"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";

type Locale = "en" | "ar";

type MarketOption = {
  code: MarketCode;
  label: string;
  currency: string;
};

type RateRow = {
  id: string;
  marketId: string;
  code: string;
  amount: string;
  currency: string;
  perUnit: boolean;
  isActive: boolean;
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  save: string;
  marketLabel: string;
  codeColumn: string;
  amountColumn: string;
  perUnitColumn: string;
  activeColumn: string;
  actionsColumn: string;
  rateLabels: Record<string, string>;
  perUnitYes: string;
  perUnitNo: string;
  activeYes: string;
  activeNo: string;
  subtitleHint: string;
};

export default function AdminShippingRatesForm({
  locale,
  ui,
  markets,
  initialMarketCode,
}: {
  locale: Locale;
  ui: Ui;
  markets: MarketOption[];
  initialMarketCode: MarketCode;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [marketCode, setMarketCode] = useState<MarketCode>(initialMarketCode);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { amount: string; perUnit: boolean; isActive: boolean }>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.code === marketCode) ?? markets[0],
    [marketCode, markets],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/shipping/rates?marketCode=${marketCode}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { rates: RateRow[] };
      setRates(data.rates);
      const nextDrafts: Record<string, { amount: string; perUnit: boolean; isActive: boolean }> = {};
      for (const rate of data.rates) {
        nextDrafts[rate.code] = {
          amount: rate.amount,
          perUnit: rate.perUnit,
          isActive: rate.isActive,
        };
      }
      setDrafts(nextDrafts);
    } catch {
      toast.error(ui.loadError);
      setRates([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [marketCode, toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRate(code: string) {
    const draft = drafts[code];
    if (!draft) return;
    setSavingCode(code);
    try {
      const res = await fetch("/api/v1/admin/shipping/rates", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketCode,
          code,
          amount: Number(draft.amount),
          perUnit: draft.perUnit,
          isActive: draft.isActive,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; rate?: RateRow } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      if (payload?.rate) {
        setRates((prev) => prev.map((row) => (row.code === code ? payload.rate! : row)));
      }
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      <p className="text-sm text-[var(--muted)]">{ui.subtitleHint}</p>
      <label className="flex max-w-sm flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.marketLabel}</span>
        <select
          className="app-input"
          value={marketCode}
          disabled={loading || Boolean(savingCode)}
          onChange={(e) => setMarketCode(e.target.value as MarketCode)}
        >
          {markets.map((market) => (
            <option key={market.code} value={market.code}>
              {market.label} ({market.currency})
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.codeColumn}</th>
                <th className="px-4 py-3 font-medium">{ui.amountColumn}</th>
                <th className="px-4 py-3 font-medium">{ui.perUnitColumn}</th>
                <th className="px-4 py-3 font-medium">{ui.activeColumn}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const draft = drafts[rate.code] ?? {
                  amount: rate.amount,
                  perUnit: rate.perUnit,
                  isActive: rate.isActive,
                };
                const busy = savingCode === rate.code;
                return (
                  <tr key={rate.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{ui.rateLabels[rate.code] ?? rate.code}</div>
                      <div className="text-xs text-[var(--muted)]">{rate.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="app-input w-28"
                          value={draft.amount}
                          disabled={busy}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [rate.code]: { ...draft, amount: e.target.value },
                            }))
                          }
                        />
                        <span className="text-[var(--muted)]">{selectedMarket?.currency ?? rate.currency}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {formatMoney(draft.amount, rate.currency, locale)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draft.perUnit}
                          disabled={busy}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [rate.code]: { ...draft, perUnit: e.target.checked },
                            }))
                          }
                        />
                        <span>{draft.perUnit ? ui.perUnitYes : ui.perUnitNo}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          disabled={busy}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [rate.code]: { ...draft, isActive: e.target.checked },
                            }))
                          }
                        />
                        <span>{draft.isActive ? ui.activeYes : ui.activeNo}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
                        disabled={busy}
                        onClick={() => void saveRate(rate.code)}
                      >
                        {busy ? ui.saving : ui.save}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
