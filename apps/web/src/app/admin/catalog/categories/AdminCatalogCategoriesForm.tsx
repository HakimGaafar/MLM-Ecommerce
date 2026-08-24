"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type MarketOption = { code: MarketCode; label: string };

type CategoryRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type Ui = Record<string, string>;

export default function AdminCatalogCategoriesForm({
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
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({
    slug: "",
    nameEn: "",
    nameAr: "",
    sortOrder: "0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/catalog/categories?marketCode=${marketCode}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { categories: CategoryRow[] };
      setRows(data.categories);
    } catch {
      toast.error(ui.loadError ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }, [marketCode, toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory() {
    setBusyId("new");
    try {
      const res = await fetch(`/api/v1/admin/catalog/categories?marketCode=${marketCode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newRow.slug,
          nameEn: newRow.nameEn,
          nameAr: newRow.nameAr,
          sortOrder: Number(newRow.sortOrder),
          isActive: true,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      setNewRow({ slug: "", nameEn: "", nameAr: "", sortOrder: "0" });
      toast.success(ui.saved ?? "Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function updateCategory(row: CategoryRow, patch: Partial<CategoryRow>) {
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/v1/admin/catalog/categories/${row.id}?marketCode=${marketCode}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      toast.success(ui.saved ?? "Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory(row: CategoryRow) {
    if (!window.confirm(ui.deleteConfirm ?? "Delete this category?")) return;
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/v1/admin/catalog/categories/${row.id}?marketCode=${marketCode}`,
        { method: "DELETE", credentials: "include" },
      );
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
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
        <select
          className="app-input"
          value={marketCode}
          onChange={(e) => setMarketCode(e.target.value as MarketCode)}
        >
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="font-medium">{ui.addTitle}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="app-input" placeholder={ui.slug} value={newRow.slug} onChange={(e) => setNewRow({ ...newRow, slug: e.target.value })} />
          <input className="app-input" placeholder={ui.sortOrder} value={newRow.sortOrder} onChange={(e) => setNewRow({ ...newRow, sortOrder: e.target.value })} />
          <input className="app-input" placeholder={ui.nameEn} value={newRow.nameEn} onChange={(e) => setNewRow({ ...newRow, nameEn: e.target.value })} />
          <input className="app-input" placeholder={ui.nameAr} value={newRow.nameAr} onChange={(e) => setNewRow({ ...newRow, nameAr: e.target.value })} />
        </div>
        <button type="button" className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60" disabled={busyId === "new"} onClick={() => void createCategory()}>
          {busyId === "new" ? ui.saving : ui.add}
        </button>
      </section>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)]">
              <tr>
                <th className="px-3 py-2 text-left">{ui.slug}</th>
                <th className="px-3 py-2 text-left">{ui.nameEn}</th>
                <th className="px-3 py-2 text-left">{ui.nameAr}</th>
                <th className="px-3 py-2 text-left">{ui.sortOrder}</th>
                <th className="px-3 py-2 text-left">{ui.products}</th>
                <th className="px-3 py-2 text-left">{ui.active}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono text-xs">{row.slug}</td>
                  <td className="px-3 py-2">{row.nameEn}</td>
                  <td className="px-3 py-2">{row.nameAr}</td>
                  <td className="px-3 py-2">{row.sortOrder}</td>
                  <td className="px-3 py-2">{row.productCount}</td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-link text-xs" disabled={busyId === row.id} onClick={() => void updateCategory(row, { isActive: !row.isActive })}>
                      {row.isActive ? ui.activeYes : ui.activeNo}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-xs text-red-600 disabled:opacity-50" disabled={busyId === row.id || row.productCount > 0} onClick={() => void removeCategory(row)}>
                      {ui.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
