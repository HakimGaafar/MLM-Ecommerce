"use client";

import Link from "next/link";
import { VENDOR_PERMISSION_UI_GROUPS, type VendorPermissionCode } from "@mlm/shared";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";

type State = {
  vendorId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  usesDefaultFullAccess: boolean;
  grantedCodes: VendorPermissionCode[];
  allCodes: VendorPermissionCode[];
};

type Ui = {
  loading: string;
  loadError: string;
  saveError: string;
  saved: string;
  saving: string;
  save: string;
  back: string;
  store: string;
  owner: string;
  defaultAccessNote: string;
  restrictedNote: string;
  vendorGroupTitle: string;
  selectAll: string;
  clearAll: string;
  partial: string;
  actionLabels: Record<string, string>;
  groupLabels: Record<string, string>;
};

export default function AdminVendorPermissionsForm({
  vendorId,
  locale,
  ui,
}: {
  vendorId: string;
  locale: Locale;
  ui: Ui;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<Set<VendorPermissionCode>>(new Set());
  const [vendorRootOpen, setVendorRootOpen] = useState(true);
  /** Only one module accordion open at a time (`group.id` from VENDOR_PERMISSION_UI_GROUPS). */
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${encodeURIComponent(vendorId)}/permissions`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const json = (await res.json()) as { state: State };
      setState(json.state);
      setSelected(new Set(json.state.grantedCodes));
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [vendorId, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (code: VendorPermissionCode) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleVendorRoot = () => {
    setVendorRootOpen((prev) => {
      if (prev) setOpenModuleId(null);
      return !prev;
    });
  };

  const toggleModule = (moduleId: string) => {
    setOpenModuleId((prev) => (prev === moduleId ? null : moduleId));
  };

  const setGroupCodes = (codes: readonly VendorPermissionCode[], checked: boolean) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (checked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const save = async () => {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${encodeURIComponent(vendorId)}/permissions`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: [...selected] }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.saveError);
      }
      const json = (await res.json()) as { state: State };
      setState(json.state);
      setSelected(new Set(json.state.grantedCodes));
      setSaved(true);
      toast.success(ui.saved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.saveError;
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error || !state) {
    return <p className="mt-8 text-sm text-red-600 dark:text-red-400">{error ?? ui.loadError}</p>;
  }

  return (
    <div className="mt-8 space-y-6" dir={direction}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">{ui.store}:</span> {state.storeName}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">{ui.owner}:</span> {state.ownerName} (
          {state.ownerEmail})
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {state.usesDefaultFullAccess ? ui.defaultAccessNote : ui.restrictedNote}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)]">
        <button
          type="button"
          onClick={toggleVendorRoot}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-[var(--foreground)]"
        >
          <span>{ui.vendorGroupTitle}</span>
          <span className="text-[var(--muted)]">{vendorRootOpen ? "▾" : "▸"}</span>
        </button>

        {vendorRootOpen ? (
          <div className="space-y-2 border-t border-[var(--border)] px-3 py-3 dark:border-[var(--border-strong)]">
            {VENDOR_PERMISSION_UI_GROUPS.map((group) => {
              const codes = group.permissions.map((p) => p.code);
              const isOpen = openModuleId === group.id;
              const allChecked = codes.every((c) => selected.has(c));
              const someChecked = codes.some((c) => selected.has(c));

              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-[var(--border)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleModule(group.id)}
                      className="flex flex-1 items-center gap-2 text-start text-sm font-medium text-[var(--foreground)]"
                    >
                      <span className="text-[var(--muted)]">{isOpen ? "▾" : "▸"}</span>
                      {ui.groupLabels[group.id] ?? group.id}
                    </button>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => setGroupCodes(codes, true)}
                      >
                        {ui.selectAll}
                      </button>
                      <button
                        type="button"
                        className="text-[var(--muted)] underline"
                        onClick={() => setGroupCodes(codes, false)}
                      >
                        {ui.clearAll}
                      </button>
                      {someChecked && !allChecked ? (
                        <span className="text-[var(--muted)]">({ui.partial})</span>
                      ) : null}
                    </div>
                  </div>

                  {isOpen ? (
                    <ul className="space-y-1 border-t border-[var(--table-row-border)] px-3 py-2 dark:border-[var(--border)]">
                      {group.permissions.map(({ code, actionKey }) => (
                        <li key={code}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]/50">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selected.has(code)}
                              onChange={() => toggle(code)}
                            />
                            <span className="text-sm">
                              <span className="font-medium">
                                {ui.actionLabels[actionKey] ?? actionKey}
                              </span>
                              <span className="mt-0.5 block font-mono text-xs text-[var(--muted)]">{code}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {saveError ? (
        <p className="app-alert-error">
          {saveError}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{ui.saved}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? ui.saving : ui.save}
        </button>
        <Link
          href="/admin/vendors"
          className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--table-head-bg)]"
        >
          {ui.back}
        </Link>
      </div>
    </div>
  );
}