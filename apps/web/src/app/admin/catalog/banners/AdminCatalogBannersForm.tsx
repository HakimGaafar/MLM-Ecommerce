"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";
type MarketOption = { code: MarketCode; label: string };

type BannerRow = {
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Ui = Record<string, string>;

export default function AdminCatalogBannersForm({
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
  const [marketCode, setMarketCode] = useState(initialMarketCode);
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({
    titleEn: "",
    titleAr: "",
    subtitleEn: "",
    subtitleAr: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: "0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/catalog/banners?marketCode=${marketCode}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { banners: BannerRow[] };
      setRows(data.banners);
    } catch {
      toast.error(ui.loadError ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }, [marketCode, toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBanner() {
    setBusyId("new");
    try {
      const res = await fetch(`/api/v1/admin/catalog/banners?marketCode=${marketCode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleEn: newRow.titleEn,
          titleAr: newRow.titleAr,
          subtitleEn: newRow.subtitleEn || null,
          subtitleAr: newRow.subtitleAr || null,
          imageUrl: newRow.imageUrl || null,
          linkUrl: newRow.linkUrl || null,
          sortOrder: Number(newRow.sortOrder),
          isActive: true,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      setNewRow({ titleEn: "", titleAr: "", subtitleEn: "", subtitleAr: "", imageUrl: "", linkUrl: "", sortOrder: "0" });
      toast.success(ui.saved ?? "Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: BannerRow) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/v1/admin/catalog/banners/${row.id}?marketCode=${marketCode}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error(ui.saveError);
      toast.success(ui.saved ?? "Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function removeBanner(row: BannerRow) {
    if (!window.confirm(ui.deleteConfirm ?? "Delete this banner?")) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/v1/admin/catalog/banners/${row.id}?marketCode=${marketCode}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(ui.saveError);
      toast.success(ui.deleted ?? "Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-8 space-y-6" dir={direction}>
      <label className="flex max-w-sm flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.marketLabel}</span>
        <select className="app-input" value={marketCode} onChange={(e) => setMarketCode(e.target.value as MarketCode)}>
          {markets.map((m) => (
            <option key={m.code} value={m.code}>{m.label}</option>
          ))}
        </select>
      </label>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="font-medium">{ui.addTitle}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="app-input" placeholder={ui.titleEn} value={newRow.titleEn} onChange={(e) => setNewRow({ ...newRow, titleEn: e.target.value })} />
          <input className="app-input" placeholder={ui.titleAr} value={newRow.titleAr} onChange={(e) => setNewRow({ ...newRow, titleAr: e.target.value })} />
          <input className="app-input" placeholder={ui.subtitleEn} value={newRow.subtitleEn} onChange={(e) => setNewRow({ ...newRow, subtitleEn: e.target.value })} />
          <input className="app-input" placeholder={ui.subtitleAr} value={newRow.subtitleAr} onChange={(e) => setNewRow({ ...newRow, subtitleAr: e.target.value })} />
          <input className="app-input sm:col-span-2" placeholder={ui.imageUrl} value={newRow.imageUrl} onChange={(e) => setNewRow({ ...newRow, imageUrl: e.target.value })} />
          <input className="app-input sm:col-span-2" placeholder={ui.linkUrl} value={newRow.linkUrl} onChange={(e) => setNewRow({ ...newRow, linkUrl: e.target.value })} />
          <input className="app-input" placeholder={ui.sortOrder} value={newRow.sortOrder} onChange={(e) => setNewRow({ ...newRow, sortOrder: e.target.value })} />
        </div>
        <button type="button" className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60" disabled={busyId === "new"} onClick={() => void createBanner()}>
          {busyId === "new" ? ui.saving : ui.add}
        </button>
      </section>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-[var(--border)] p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{locale === "ar" ? row.titleAr : row.titleEn}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{ui.sortOrder}: {row.sortOrder}</div>
                  {row.linkUrl ? <a href={row.linkUrl} className="mt-1 block text-xs text-link" target="_blank" rel="noreferrer">{row.linkUrl}</a> : null}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="text-link text-xs" disabled={busyId === row.id} onClick={() => void toggleActive(row)}>
                    {row.isActive ? ui.activeYes : ui.activeNo}
                  </button>
                  <button type="button" className="text-xs text-red-600 disabled:opacity-50" disabled={busyId === row.id} onClick={() => void removeBanner(row)}>
                    {ui.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
