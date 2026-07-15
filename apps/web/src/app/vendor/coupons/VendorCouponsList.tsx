"use client";

import { useCallback, useEffect, useState } from "react";
import type { CouponListTab, CouponStatus } from "@mlm/shared";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatCurrencyCode } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";

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
  actions: string;
  activate: string;
  expire: string;
  delete: string;
  percentOff: string;
  fixedOff: string;
  statusDraft: string;
  statusActive: string;
  statusExpired: string;
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
    default:
      return status;
  }
}

export default function VendorCouponsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
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
      const res = await fetch(`/api/v1/vendor/coupons?${params}`, { credentials: "include", cache: "no-store" });
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
      toast.error(msg || toastDict.genericError);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, ui.loadError]);

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
      const res = await fetch("/api/v1/vendor/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      setShowForm(false);
      setFormCode("");
      setFormDescription("");
      setFormValue("");
      setFormEndsAt("");
      setFormUsageLimit("");
      toast.success(toastDict.couponCreated);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : toastDict.couponFailed;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchCoupon(
    id: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/vendor/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      toast.success(successMessage);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : toastDict.couponFailed;
      setError(msg);
      toast.error(msg);
    }
  }

  async function removeCoupon(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/vendor/coupons/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      toast.success(toastDict.couponDeleted);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : toastDict.couponFailed;
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
      {error ? (
        <p className="app-alert-error">{error}</p>
      ) : null}
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
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary btn-press"
        >
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
              <input type="radio" checked={formDiscountType === "PERCENT"} onChange={() => setFormDiscountType("PERCENT")} />
              {ui.formPercent}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={formDiscountType === "FIXED"} onChange={() => setFormDiscountType("FIXED")} />
              {ui.formFixed}
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formValue}</span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.formEndsAt}</span>
            <input
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
              min="1"
              value={formUsageLimit}
              onChange={(e) => setFormUsageLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 dark:bg-[var(--surface)]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? ui.formSubmitting : ui.formSubmit}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm"
            >
              {ui.formCancel}
            </button>
          </div>
        </form>
      ) : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)] dark:border-[var(--border-strong)] dark:text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[36rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.code}</th>
                <th className="px-4 py-3 font-medium">{ui.discount}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium">{ui.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{row.code}</td>
                  <td className="px-4 py-3">{discountLabel(row)}</td>
                  <td className="px-4 py-3">{statusLabel(row.effectiveStatus, ui)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === "DRAFT" && row.effectiveStatus !== "EXPIRED" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void patchCoupon(row.id, { status: "ACTIVE" }, toastDict.couponActivated)
                            }
                            className="text-xs text-link underline"
                          >
                            {ui.activate}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeCoupon(row.id)}
                            className="text-xs text-red-600 underline"
                          >
                            {ui.delete}
                          </button>
                        </>
                      )}
                      {row.status === "ACTIVE" && row.effectiveStatus === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() =>
                            void patchCoupon(row.id, { status: "EXPIRED" }, toastDict.couponExpired)
                          }
                          className="text-xs text-[var(--muted)] underline"
                        >
                          {ui.expire}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 0 ? (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
        />
      ) : null}
    </div>
  );
}