"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type OptionRow = {
  id: string;
  listKey: string;
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
  isActive: boolean;
};

type Ui = Record<string, string>;

export default function AdminVendorFormListsForm({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({
    code: "",
    labelEn: "",
    labelAr: "",
    sortOrder: "100",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/vendor-form-lists?listKey=LICENSE_TYPE", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { options: OptionRow[] };
      setRows(data.options);
    } catch {
      toast.error(ui.loadError ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }, [toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOption() {
    setBusyId("new");
    try {
      const res = await fetch("/api/v1/admin/vendor-form-lists", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listKey: "LICENSE_TYPE",
          code: newRow.code,
          labelEn: newRow.labelEn,
          labelAr: newRow.labelAr,
          sortOrder: Number(newRow.sortOrder),
          isActive: true,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.saveError);
      setNewRow({ code: "", labelEn: "", labelAr: "", sortOrder: "100" });
      toast.success(ui.saved ?? "Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function updateOption(row: OptionRow, patch: Partial<OptionRow>) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/v1/admin/vendor-form-lists/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
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

  async function removeOption(row: OptionRow) {
    if (!window.confirm(ui.deleteConfirm ?? "Delete this option?")) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/v1/admin/vendor-form-lists/${row.id}`, {
        method: "DELETE",
        credentials: "include",
      });
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
      <p className="text-sm text-[var(--muted)]">{ui.listHint}</p>

      <section className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="text-base font-semibold">{ui.addTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-[var(--muted)]">{ui.code}</span>
            <input
              className="app-input mt-1"
              value={newRow.code}
              onChange={(e) => setNewRow((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">{ui.sortOrder}</span>
            <input
              className="app-input mt-1"
              type="number"
              value={newRow.sortOrder}
              onChange={(e) => setNewRow((prev) => ({ ...prev, sortOrder: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">{ui.labelEn}</span>
            <input
              className="app-input mt-1"
              value={newRow.labelEn}
              onChange={(e) => setNewRow((prev) => ({ ...prev, labelEn: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">{ui.labelAr}</span>
            <input
              className="app-input mt-1"
              dir="rtl"
              value={newRow.labelAr}
              onChange={(e) => setNewRow((prev) => ({ ...prev, labelAr: e.target.value }))}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-primary btn-press mt-4 text-sm"
          disabled={busyId === "new"}
          onClick={() => void createOption()}
        >
          {busyId === "new" ? ui.saving : ui.add}
        </button>
      </section>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold">{row.code}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-press text-xs"
                  disabled={busyId === row.id}
                  onClick={() => void updateOption(row, { isActive: !row.isActive })}
                >
                  {row.isActive ? ui.activeYes : ui.activeNo}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-press text-xs text-red-400"
                  disabled={busyId === row.id}
                  onClick={() => void removeOption(row)}
                >
                  {ui.delete}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-[var(--muted)]">{ui.labelEn}</span>
                <input
                  className="app-input mt-1"
                  defaultValue={row.labelEn}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== row.labelEn) void updateOption(row, { labelEn: next });
                  }}
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">{ui.labelAr}</span>
                <input
                  className="app-input mt-1"
                  dir="rtl"
                  defaultValue={row.labelAr}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== row.labelAr) void updateOption(row, { labelAr: next });
                  }}
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">{ui.sortOrder}</span>
                <input
                  className="app-input mt-1"
                  type="number"
                  defaultValue={row.sortOrder}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isNaN(next) && next !== row.sortOrder) {
                      void updateOption(row, { sortOrder: next });
                    }
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
