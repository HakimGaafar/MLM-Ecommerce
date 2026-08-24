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
  geoCountryCodes: string[];
  isActive: boolean;
  sortOrder: number;
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
  sortOrder: string;
  nameEn: string;
  nameAr: string;
  geoCountries: string;
  geoHint: string;
  saveDetails: string;
  editDetails: string;
};

type EditDraft = {
  nameEn: string;
  nameAr: string;
  sortOrder: string;
  geoCountryCodes: string;
};

export default function AdminMarketsForm({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<MarketCode | null>(null);
  const [editingCode, setEditingCode] = useState<MarketCode | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<MarketCode, EditDraft>>>({});

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

  function openEdit(market: MarketRow) {
    setEditingCode(market.code);
    setDrafts((prev) => ({
      ...prev,
      [market.code]: {
        nameEn: market.nameEn,
        nameAr: market.nameAr,
        sortOrder: String(market.sortOrder),
        geoCountryCodes: market.geoCountryCodes.join(", "),
      },
    }));
  }

  async function saveDetails(market: MarketRow) {
    const draft = drafts[market.code];
    if (!draft) return;
    setSavingCode(market.code);
    try {
      const geoCountryCodes = draft.geoCountryCodes
        .split(/[,\s]+/)
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length === 2);
      const res = await fetch(`/api/v1/admin/markets?marketCode=${market.code}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn: draft.nameEn,
          nameAr: draft.nameAr,
          sortOrder: Number(draft.sortOrder),
          geoCountryCodes,
        }),
      });
      const data = (await res.json().catch(() => null)) as { market?: MarketRow; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? ui.saveError);
      if (data?.market) {
        setMarkets((prev) => prev.map((row) => (row.code === data.market!.code ? data.market! : row)));
      }
      setEditingCode(null);
      toast.success(ui.saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setSavingCode(null);
    }
  }

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
      <div className="space-y-4">
        {markets.map((market) => {
          const label = locale === "ar" ? market.nameAr : market.nameEn;
          const busy = savingCode === market.code;
          const editing = editingCode === market.code;
          const draft = drafts[market.code];
          return (
            <div key={market.code} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {market.code} · {ui.subdomain}: {market.subdomain} · {ui.currency}: {market.defaultCurrency}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {ui.sortOrder}: {market.sortOrder} · {ui.geoCountries}: {market.geoCountryCodes.join(", ") || "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      market.isActive
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        : "rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    }
                  >
                    {market.isActive ? ui.active : ui.inactive}
                  </span>
                  <button
                    type="button"
                    className="text-sm text-link"
                    disabled={busy}
                    onClick={() => (editing ? setEditingCode(null) : openEdit(market))}
                  >
                    {editing ? ui.saving : ui.editDetails}
                  </button>
                  {market.isActive ? (
                    <button
                      type="button"
                      className="text-sm text-red-600 disabled:opacity-50"
                      disabled={busy || !market.canDisable}
                      onClick={() => void toggleMarket(market, false)}
                    >
                      {ui.disable}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-link disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void toggleMarket(market, true)}
                    >
                      {ui.enable}
                    </button>
                  )}
                </div>
              </div>

              {editing && draft ? (
                <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--muted)]">{ui.nameEn}</span>
                    <input className="app-input" value={draft.nameEn} onChange={(e) => setDrafts((prev) => ({ ...prev, [market.code]: { ...draft, nameEn: e.target.value } }))} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--muted)]">{ui.nameAr}</span>
                    <input className="app-input" value={draft.nameAr} onChange={(e) => setDrafts((prev) => ({ ...prev, [market.code]: { ...draft, nameAr: e.target.value } }))} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--muted)]">{ui.sortOrder}</span>
                    <input className="app-input" type="number" min={0} value={draft.sortOrder} onChange={(e) => setDrafts((prev) => ({ ...prev, [market.code]: { ...draft, sortOrder: e.target.value } }))} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="text-[var(--muted)]">{ui.geoCountries}</span>
                    <input className="app-input" value={draft.geoCountryCodes} placeholder="SA, AE" onChange={(e) => setDrafts((prev) => ({ ...prev, [market.code]: { ...draft, geoCountryCodes: e.target.value } }))} />
                    <span className="text-xs text-[var(--muted)]">{ui.geoHint}</span>
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60 sm:col-span-2 sm:w-fit"
                    disabled={busy}
                    onClick={() => void saveDetails(market)}
                  >
                    {busy ? ui.saving : ui.saveDetails}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
