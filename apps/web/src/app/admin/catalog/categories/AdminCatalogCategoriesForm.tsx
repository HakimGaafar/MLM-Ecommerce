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

type EditDraft = {
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: string;
};

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
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
      setEditingId(null);
      setEditDraft(null);
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

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setEditDraft({
      slug: row.slug,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      sortOrder: String(row.sortOrder),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(row: CategoryRow) {
    if (!editDraft) return;
    await updateCategory(row, {
      slug: editDraft.slug.trim(),
      nameEn: editDraft.nameEn.trim(),
      nameAr: editDraft.nameAr.trim(),
      sortOrder: Number(editDraft.sortOrder),
    });
  }

  return (
    <div className="mt-8 space-y-6" dir={direction}>
      <label className="flex max-w-sm flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">{ui.marketLabel}</span>
        <select
          className="app-input"
          value={marketCode}
          onChange={(e) => {
            setMarketCode(e.target.value as MarketCode);
            cancelEdit();
          }}
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
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.slug}</span>
            <input
              className="app-input mt-1"
              placeholder={ui.slugPlaceholder}
              value={newRow.slug}
              onChange={(e) => setNewRow({ ...newRow, slug: e.target.value })}
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">{ui.slugHint}</span>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.sortOrder}</span>
            <input
              className="app-input mt-1"
              value={newRow.sortOrder}
              onChange={(e) => setNewRow({ ...newRow, sortOrder: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
            />
          </label>
          <input
            className="app-input"
            placeholder={ui.nameEn}
            value={newRow.nameEn}
            onChange={(e) => setNewRow({ ...newRow, nameEn: e.target.value })}
          />
          <input
            className="app-input"
            placeholder={ui.nameAr}
            value={newRow.nameAr}
            onChange={(e) => setNewRow({ ...newRow, nameAr: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-60"
          disabled={busyId === "new"}
          onClick={() => void createCategory()}
        >
          {busyId === "new" ? ui.saving : ui.add}
        </button>
      </section>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[720px] text-sm">
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
              {rows.map((row) => {
                const editing = editingId === row.id && editDraft;
                return (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      {editing ? (
                        <input
                          className="app-input font-mono text-xs"
                          value={editDraft.slug}
                          onChange={(e) => setEditDraft({ ...editDraft, slug: e.target.value })}
                        />
                      ) : (
                        <span className="font-mono text-xs">{row.slug}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <input
                          className="app-input"
                          value={editDraft.nameEn}
                          onChange={(e) => setEditDraft({ ...editDraft, nameEn: e.target.value })}
                        />
                      ) : (
                        row.nameEn
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <input
                          className="app-input"
                          dir="rtl"
                          value={editDraft.nameAr}
                          onChange={(e) => setEditDraft({ ...editDraft, nameAr: e.target.value })}
                        />
                      ) : (
                        row.nameAr
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <input
                          className="app-input w-20"
                          value={editDraft.sortOrder}
                          onChange={(e) => setEditDraft({ ...editDraft, sortOrder: e.target.value })}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      ) : (
                        row.sortOrder
                      )}
                    </td>
                    <td className="px-3 py-2">{row.productCount}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-link text-xs"
                        disabled={busyId === row.id || Boolean(editing)}
                        onClick={() => void updateCategory(row, { isActive: !row.isActive })}
                      >
                        {row.isActive ? ui.activeYes : ui.activeNo}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              className="text-xs font-medium text-link"
                              disabled={busyId === row.id}
                              onClick={() => void saveEdit(row)}
                            >
                              {busyId === row.id ? ui.saving : ui.save}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-[var(--muted)]"
                              disabled={busyId === row.id}
                              onClick={cancelEdit}
                            >
                              {ui.cancel}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="text-xs font-medium text-link"
                              disabled={busyId === row.id}
                              onClick={() => startEdit(row)}
                            >
                              {ui.edit}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-600 disabled:opacity-50"
                              disabled={busyId === row.id || row.productCount > 0}
                              onClick={() => void removeCategory(row)}
                            >
                              {ui.delete}
                            </button>
                          </>
                        )}
                      </div>
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
