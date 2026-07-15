"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import Pagination from "@/components/Pagination";
import RejectReasonDialog from "@/components/RejectReasonDialog";
import { useToast } from "@/components/toast/ToastProvider";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";
type Tab = "new_pending" | "edit_pending" | "approved" | "rejected";

type Row = {
  id: string;
  reviewSubjectId: string;
  name: string;
  price: string;
  currency: string;
  fulfillmentType?: string;
  storeName: string;
  storeSlug: string;
  reviewedAt?: string;
  reviewedByName?: string | null;
  queueType?: "NEW_PRODUCT" | "EDIT_REQUEST";
  rejectionReason?: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  emptyPending: string;
  emptyEditPending: string;
  emptyApproved: string;
  emptyRejected: string;
  product: string;
  vendor: string;
  price: string;
  fulfillment: string;
  reviewedAt: string;
  reviewedBy: string;
  approve: string;
  reject: string;
  viewStore: string;
  toastApproved: string;
  toastRejected: string;
  toastError: string;
  tabPending: string;
  tabEditPending: string;
  tabApproved: string;
  tabRejected: string;
  rejectionReason: string;
  rejectDialogTitle: string;
  rejectDialogDescription: string;
  rejectReasonPlaceholder: string;
  rejectReasonRequired: string;
  rejectDialogCancel: string;
};

function formatWhen(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AdminPendingProductsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [tab, setTab] = useState<Tab>("new_pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const emptyMessage =
    tab === "new_pending"
      ? ui.emptyPending
      : tab === "edit_pending"
      ? ui.emptyEditPending
      : tab === "approved"
      ? ui.emptyApproved
      : ui.emptyRejected;

  const fulfillmentDict =
    locale === "ar" ? ar.customerOrderDetail : en.customerOrderDetail;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/approvals?tab=${tab}&page=${page}&pageSize=${pageSize}`,
        {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: Row[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
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

  async function submitReview(id: string, action: "approve" | "reject", rejectionReason?: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/products/${id}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, rejectionReason }),
      });
      if (!res.ok) throw new Error(ui.loadError);
      toast.success(action === "approve" ? ui.toastApproved : ui.toastRejected);
      if (action === "reject") setRejectTarget(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  function review(id: string, action: "approve" | "reject", productName?: string) {
    if (action === "reject") {
      setRejectTarget({ id, name: productName ?? "" });
      return;
    }
    void submitReview(id, action);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "new_pending", label: ui.tabPending },
    { key: "edit_pending", label: ui.tabEditPending },
    { key: "approved", label: ui.tabApproved },
    { key: "rejected", label: ui.tabRejected },
  ];

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      <RejectReasonDialog
        open={rejectTarget !== null}
        title={ui.rejectDialogTitle}
        description={ui.rejectDialogDescription}
        subjectName={rejectTarget?.name}
        reasonLabel={ui.rejectionReason}
        reasonPlaceholder={ui.rejectReasonPlaceholder}
        reasonRequired={ui.rejectReasonRequired}
        confirmLabel={ui.reject}
        cancelLabel={ui.rejectDialogCancel}
        confirming={rejectTarget !== null && busyId === rejectTarget.id}
        onCancel={() => {
          if (busyId) return;
          setRejectTarget(null);
        }}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          void submitReview(rejectTarget.id, "reject", reason);
        }}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
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
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)] dark:border-[var(--border-strong)] dark:text-[var(--muted)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3">{ui.product}</th>
                <th className="px-4 py-3">{ui.vendor}</th>
                <th className="px-4 py-3">{ui.fulfillment}</th>
                <th className="px-4 py-3">{ui.price}</th>
                {tab !== "new_pending" && tab !== "edit_pending" ? (
                  <>
                    <th className="px-4 py-3">{ui.reviewedAt}</th>
                    <th className="px-4 py-3">{ui.reviewedBy}</th>
                    <th className="px-4 py-3">{ui.rejectionReason}</th>
                  </>
                ) : null}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${tab}-${row.id}-${row.reviewedAt ?? ""}`} className="border-t border-[var(--table-row-border)]">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.storeName}{" "}
                    <Link
                      href={`/stores/${row.storeSlug}`}
                      className="text-link"
                    >
                      {ui.viewStore}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {fulfillmentTypeLabel(row.fulfillmentType ?? "DIRECT", fulfillmentDict)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.price, row.currency, locale)}
                  </td>
                  {tab !== "new_pending" && tab !== "edit_pending" ? (
                    <>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {row.reviewedAt ? formatWhen(row.reviewedAt, locale) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {row.reviewedByName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {row.rejectionReason ?? "—"}
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-3 text-end">
                    {tab === "new_pending" || tab === "edit_pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void review(row.reviewSubjectId, "approve")}
                          className="me-2 inline-flex min-w-[84px] justify-center rounded px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {ui.approve}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => review(row.reviewSubjectId, "reject", row.name)}
                          className="inline-flex min-w-[84px] justify-center rounded px-3 py-1 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
                        >
                          {ui.reject}
                        </button>
                      </>
                    ) : null}
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
