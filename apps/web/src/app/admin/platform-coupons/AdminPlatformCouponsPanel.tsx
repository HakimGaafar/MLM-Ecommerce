"use client";

import { useCallback, useEffect, useState } from "react";
import type { CouponListTab, CouponStatus } from "@mlm/shared";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatCurrencyCode } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import DateField from "@/components/ui/DateField";

type Locale = "en" | "ar";

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: string;
  currency: string;
  status: CouponStatus;
  effectiveStatus: CouponStatus;
  usedCount: number;
  usageLimit: number | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  tabAll: string;
  tabActive: string;
  tabDraft: string;
  tabExpired: string;
  code: string;
  discount: string;
  status: string;
  usage: string;
  actions: string;
  activate: string;
  suspend: string;
  terminate: string;
  delete: string;
  percentOff: string;
  fixedOff: string;
  statusDraft: string;
  statusActive: string;
  statusExpired: string;
  statusSuspended: string;
  statusTerminated: string;
  createTitle: string;
  formCode: string;
  formDescription: string;
  formPercent: string;
  formFixed: string;
  formValue: string;
  formEndsAt: string;
  formUsageLimit: string;
  formSubmit: string;
  formSubmitting: string;
  formCancel: string;
  created: string;
  updated: string;
  deleted: string;
  failed: string;
};

const TABS: { key: CouponListTab; labelKey: keyof Ui }[] = [
  { key: "ALL", labelKey: "tabAll" },
  { key: "ACTIVE", labelKey: "tabActive" },
  { key: "DRAFT", labelKey: "tabDraft" },
  { key: "EXPIRED", labelKey: "tabExpired" },
];

function statusLabel(status: CouponStatus, ui: Ui): string {
  switch (status) {
    case "DRAFT":
      return ui.statusDraft;
    case "ACTIVE":
      return ui.statusActive;
    case "EXPIRED":
      return ui.statusExpired;
    case "SUSPENDED":
      return ui.statusSuspended;
    case "TERMINATED":
      return ui.statusTerminated;
    default:
      return status;
  }
}

export default function AdminPlatformCouponsPanel({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [tab, setTab] = useState<CouponListTab>("ALL");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CouponRow[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [formValue, setFormValue] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tab !== "ALL") params.set("tab", tab);
      const res = await fetch(`/api/v1/admin/platform-coupons?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: CouponRow[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, ui.loadError, toast]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        code: formCode,
        description: formDescription || undefined,
        discountType: formDiscountType,
        discountValue: Number(formValue),
      };
      if (formEndsAt) body.endsAt = new Date(formEndsAt).toISOString();
      if (formUsageLimit) body.usageLimit = Number(formUsageLimit);
      const res = await fetch("/api/v1/admin/platform-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.failed);
      }
      setShowForm(false);
      setFormCode("");
      setFormDescription("");
      setFormValue("");
      setFormEndsAt("");
      setFormUsageLimit("");
      toast.success(ui.created);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.failed;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchCoupon(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/platform-coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.failed);
      }
      toast.success(ui.updated);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.failed;
      setError(msg);
      toast.error(msg);
    }
  }

  async function removeCoupon(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/platform-coupons/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.failed);
      }
      toast.success(ui.deleted);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.failed;
      setError(msg);
      toast.error(msg);
    }
  }

  function discountLabel(row: CouponRow) {
    if (row.discountType === "PERCENT") {
      return ui.percentOff.replace("{value}", row.discountValue);
    }
    return ui.fixedOff
      .replace("{value}", row.discountValue)
      .replace("{currency}", formatCurrencyCode(row.currency, locale));
  }

  return (
    <div className="space-y-4" dir={direction}>
      {error ? <p className="app-alert-error">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === t.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border border-[var(--border-strong)] text-[var(--foreground)]"
            }`}
          >
            {ui[t.labelKey]}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary btn-press">
          {ui.createTitle}
        </button>
      </div>
      {showForm ? (
        <form onSubmit={(e) => void createCoupon(e)} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold">{ui.createTitle}</h2>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formCode}</span>
            <input
              required
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formDescription}</span>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formDiscountType === "PERCENT"}
                onChange={() => setFormDiscountType("PERCENT")}
              />
              {ui.formPercent}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formDiscountType === "FIXED"}
                onChange={() => setFormDiscountType("FIXED")}
              />
              {ui.formFixed}
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formValue}</span>
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formEndsAt}</span>
            <DateField
              type="datetime-local"
              value={formEndsAt}
              onChange={(e) => setFormEndsAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formUsageLimit}</span>
            <input
              type="number"
              min={1}
              value={formUsageLimit}
              onChange={(e) => setFormUsageLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="btn-primary btn-press">
              {submitting ? ui.formSubmitting : ui.formSubmit}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              {ui.formCancel}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{ui.code}</th>
                <th className="px-3 py-2 text-start font-medium">{ui.discount}</th>
                <th className="px-3 py-2 text-start font-medium">{ui.status}</th>
                <th className="px-3 py-2 text-start font-medium">{ui.usage}</th>
                <th className="px-3 py-2 text-start font-medium">{ui.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{row.code}</td>
                  <td className="px-3 py-2">{discountLabel(row)}</td>
                  <td className="px-3 py-2">{statusLabel(row.effectiveStatus, ui)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.usedCount}
                    {row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {row.status === "DRAFT" ? (
                        <>
                          <button
                            type="button"
                            className="text-link text-xs"
                            onClick={() => void patchCoupon(row.id, { status: "ACTIVE" })}
                          >
                            {ui.activate}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)]"
                            onClick={() => void removeCoupon(row.id)}
                          >
                            {ui.delete}
                          </button>
                        </>
                      ) : null}
                      {row.status === "ACTIVE" ? (
                        <>
                          <button
                            type="button"
                            className="text-link text-xs"
                            onClick={() => void patchCoupon(row.id, { status: "SUSPENDED" })}
                          >
                            {ui.suspend}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)]"
                            onClick={() => void patchCoupon(row.id, { status: "TERMINATED" })}
                          >
                            {ui.terminate}
                          </button>
                        </>
                      ) : null}
                      {row.status === "SUSPENDED" ? (
                        <>
                          <button
                            type="button"
                            className="text-link text-xs"
                            onClick={() => void patchCoupon(row.id, { status: "ACTIVE" })}
                          >
                            {ui.activate}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)]"
                            onClick={() => void patchCoupon(row.id, { status: "TERMINATED" })}
                          >
                            {ui.terminate}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        labels={getPaginationLabels(locale)}
      />
    </div>
  );
}
