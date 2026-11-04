"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import RejectReasonDialog from "@/components/RejectReasonDialog";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type Row = {
  offerId: string;
  productId: string;
  productName: string;
  marketCode: string;
  price: string;
  currency: string;
  stockLocation: string;
  vandsoqMode: string | null;
  quantity: number;
  storeName: string;
  storeSlug: string;
  vendorShippingProfileStatus: string;
  homeMarketId: string;
  submittedAt: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  product: string;
  vendor: string;
  price: string;
  stock: string;
  shippingProfile: string;
  approve: string;
  reject: string;
  toastApproved: string;
  toastRejected: string;
  toastError: string;
  rejectionReason: string;
  rejectDialogTitle: string;
  rejectDialogDescription: string;
  rejectReasonPlaceholder: string;
  rejectReasonRequired: string;
  rejectDialogCancel: string;
  stockMerchant: string;
  stockVandsoq: string;
  viewStore: string;
};

export default function AdminMarketOffersList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/products/market-offers/pending?page=${page}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: Row[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(offerId: string, action: "approve" | "reject", rejectionReason?: string) {
    setBusyId(offerId);
    try {
      const res = await fetch(`/api/v1/admin/products/market-offers/${offerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      });
      if (!res.ok) throw new Error(ui.toastError);
      toast.success(action === "approve" ? ui.toastApproved : ui.toastRejected);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.toastError);
    } finally {
      setBusyId(null);
      setRejectTarget(null);
    }
  }

  return (
    <div dir={direction}>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.product}</th>
                <th className="px-4 py-3 font-medium">{ui.vendor}</th>
                <th className="px-4 py-3 font-medium">{ui.price}</th>
                <th className="px-4 py-3 font-medium">{ui.stock}</th>
                <th className="px-4 py-3 font-medium">{ui.shippingProfile}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.offerId} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.productName}</p>
                    <p className="text-xs text-[var(--muted)]">{row.marketCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{row.storeName}</p>
                    <Link
                      href={`/stores/${row.storeSlug}`}
                      className="text-xs font-medium text-link"
                      target="_blank"
                    >
                      {ui.viewStore}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.price, row.currency, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <p>
                      {row.stockLocation === "VANDSOQ_WAREHOUSE"
                        ? ui.stockVandsoq
                        : ui.stockMerchant}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      qty {row.quantity}
                      {row.vandsoqMode ? ` · ${row.vandsoqMode}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.vendorShippingProfileStatus}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary text-sm disabled:opacity-50"
                        disabled={busyId === row.offerId}
                        onClick={() => void review(row.offerId, "approve")}
                      >
                        {ui.approve}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-sm disabled:opacity-50"
                        disabled={busyId === row.offerId}
                        onClick={() =>
                          setRejectTarget({ id: row.offerId, name: row.productName })
                        }
                      >
                        {ui.reject}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
        />
      </div>

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
          void review(rejectTarget.id, "reject", reason);
        }}
      />
    </div>
  );
}
