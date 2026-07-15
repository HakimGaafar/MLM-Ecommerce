"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type MarketRow = {
  id: string;
  code: MarketCode;
  subdomain: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  isActive: boolean;
  canDisable: boolean;
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  active: string;
  inactive: string;
  subdomain: string;
  currency: string;
  defaultMarketNote: string;
  statusColumn: string;
  marketColumn: string;
  enable: string;
  disable: string;
  cannotDisableDefault: string;
  lastActiveError: string;
};

export default function AdminMarketsForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<MarketCode | null>(null);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/markets", { credentials: "include" });
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as { markets: MarketRow[] };
      setMarkets(data.markets);
    } catch {
      toast.error(ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [toast, ui.loadError]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  async function toggleMarket(market: MarketRow, nextActive: boolean) {
    if (!nextActive && !market.canDisable) {
      toast.error(ui.cannotDisableDefault);
      return;
    }

    setSavingCode(market.code);
    try {
      const res = await fetch(`/api/v1/admin/markets?marketCode=${market.code}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = (await res.json().catch(() => null)) as { market?: MarketRow; error?: string } | null;
      if (!res.ok) {
        const message =
          data?.error === "Saudi Arabia is the default market and cannot be disabled."
            ? ui.cannotDisableDefault
            : data?.error === "At least one marketplace must remain active."
              ? ui.lastActiveError
              : ui.saveError;
        toast.error(message);
        return;
      }
      if (data?.market) {
        setMarkets((prev) => prev.map((row) => (row.code === data.market!.code ? data.market! : row)));
      }
      toast.success(ui.saved);
    } catch {
      toast.error(ui.saveError);
    } finally {
      setSavingCode(null);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      <p className="text-sm text-[var(--muted)]">{ui.defaultMarketNote}</p>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-elevated)] text-left">
            <tr>
              <th className="px-4 py-3 font-medium">{ui.marketColumn}</th>
              <th className="px-4 py-3 font-medium">{ui.subdomain}</th>
              <th className="px-4 py-3 font-medium">{ui.currency}</th>
              <th className="px-4 py-3 font-medium">{ui.statusColumn}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => {
              const label = locale === "ar" ? market.nameAr : market.nameEn;
              const busy = savingCode === market.code;
              return (
                <tr key={market.code} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{market.subdomain}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{market.defaultCurrency}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        market.isActive
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                          : "rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      }
                    >
                      {market.isActive ? ui.active : ui.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {market.isActive ? (
                      <button
                        type="button"
                        className="btn-press cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-red-600 disabled:hover:no-underline dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                        disabled={busy || !market.canDisable}
                        onClick={() => void toggleMarket(market, false)}
                      >
                        {busy ? ui.saving : ui.disable}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-press cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium text-link transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                        disabled={busy}
                        onClick={() => void toggleMarket(market, true)}
                      >
                        {busy ? ui.saving : ui.enable}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
