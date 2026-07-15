"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ProductStatus } from "@mlm/shared";
import CatalogProductThumb from "@/components/catalog/CatalogProductThumb";
import { useAppLocale } from "@/components/providers/LocaleProvider";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";

type Locale = "en" | "ar";

type ProductImage = {
  url: string;
  isPrimary: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  price: string;
  currency: string;
  status: ProductStatus;
  categoryName: string;
  fulfillmentType: string;
  images: ProductImage[];
  pendingEditRequestId: string | null;
  pendingEditRequestedAt: string | null;
  latestEditRejectionReason: string | null;
  latestProductRejectionReason: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  newProduct: string;
  importCsv: string;
  edit: string;
  name: string;
  price: string;
  status: string;
  category: string;
  fulfillment: string;
  image: string;
  tabAll: string;
  tabDraft: string;
  tabPending: string;
  tabPublished: string;
  tabOnHold: string;
  tabRejected: string;
  submitForReview: string;
  putOnHold: string;
  statusDraft: string;
  statusPending: string;
  statusPublished: string;
  statusOnHold: string;
  statusRejected: string;
  rejectedNote: string;
  editPendingNote: string;
  editRejectedReasonLabel: string;
  productRejectedReasonLabel: string;
  newProductsDraft: string;
  delete: string;
  deleteDialogTitle: string;
  deleteConfirm: string;
  deleteDialogConfirm: string;
  deleteDialogCancel: string;
  deleting: string;
  deleteErrorPublished: string;
  deleteErrorOrders: string;
};

const TABS: { key: ProductStatus | "ALL"; labelKey: keyof Ui }[] = [
  { key: "ALL", labelKey: "tabAll" },
  { key: "DRAFT", labelKey: "tabDraft" },
  { key: "PENDING", labelKey: "tabPending" },
  { key: "PUBLISHED", labelKey: "tabPublished" },
  { key: "ON_HOLD", labelKey: "tabOnHold" },
  { key: "REJECTED", labelKey: "tabRejected" },
];

function statusLabel(status: ProductStatus, ui: Ui): string {
  switch (status) {
    case "DRAFT":
      return ui.statusDraft;
    case "PENDING":
      return ui.statusPending;
    case "PUBLISHED":
      return ui.statusPublished;
    case "ON_HOLD":
      return ui.statusOnHold;
    case "REJECTED":
      return ui.statusRejected;
    default:
      return status;
  }
}

function primaryImageUrl(images: ProductImage[]): string | null {
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return primary?.url ?? null;
}

export default function VendorProductsList({
  ui,
  canDelete,
  canImport,
}: {
  ui: Ui;
  canDelete: boolean;
  canImport: boolean;
}) {
  const locale = useAppLocale();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [tab, setTab] = useState<ProductStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const fulfillmentDict = locale === "ar" ? ar.customerOrderDetail : en.customerOrderDetail;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        locale,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tab !== "ALL") params.set("status", tab);
      const res = await fetch(`/api/v1/vendor/products?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: ProductRow[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, ui.loadError, locale]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitForReview(row: ProductRow) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/vendor/products/${row.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(ui.loadError);
      toast.success(toastDict.productSubmitted);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : toastDict.productSubmitFailed;
      setError(msg);
      toast.error(msg);
    }
  }

  async function confirmDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/vendor/products/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        if (p?.code === "INVALID_STATUS") throw new Error(ui.deleteErrorPublished);
        if (p?.code === "HAS_ORDER_HISTORY") throw new Error(ui.deleteErrorOrders);
        throw new Error(p?.error ?? ui.loadError);
      }
      setDeleteTarget(null);
      toast.success(toastDict.productDeleted);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function putOnHold(row: ProductRow) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/vendor/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "ON_HOLD" }),
      });
      if (!res.ok) throw new Error(ui.loadError);
      toast.success(toastDict.productOnHold);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4" dir={direction}>
      <ConfirmDialog
        open={deleteTarget !== null}
        title={ui.deleteDialogTitle}
        message={
          deleteTarget ? ui.deleteConfirm.replace("{name}", deleteTarget.name) : ""
        }
        confirmLabel={ui.deleteDialogConfirm}
        cancelLabel={ui.deleteDialogCancel}
        confirming={deleting}
        confirmingLabel={ui.deleting}
        onConfirm={() => void confirmDeleteProduct()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
      <p className="text-sm text-[var(--muted)]">{ui.newProductsDraft}</p>
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
      <div className="flex flex-wrap justify-end gap-2">
        {canImport ? (
          <Link href="/vendor/products/import" className="btn-neutral btn-press rounded-lg px-4 py-2 text-sm font-medium">
            {ui.importCsv}
          </Link>
        ) : null}
        <Link href="/vendor/products/new" className="btn-primary btn-press">
          {ui.newProduct}
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)] dark:border-[var(--border-strong)] dark:text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[48rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="w-16 px-3 py-3 font-medium">
                  <span className="sr-only">{ui.image}</span>
                </th>
                <th className="px-4 py-3 font-medium">{ui.name}</th>
                <th className="px-4 py-3 font-medium">{ui.category}</th>
                <th className="px-4 py-3 font-medium">{ui.fulfillment}</th>
                <th className="px-4 py-3 font-medium">{ui.price}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                  <td className="px-3 py-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]">
                      <CatalogProductThumb
                        src={primaryImageUrl(row.images)}
                        alt={row.name}
                        sizes="48px"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.categoryName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {fulfillmentTypeLabel(row.fulfillmentType ?? "DIRECT", fulfillmentDict)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.price, row.currency, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-[var(--muted)]">{statusLabel(row.status, ui)}</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {row.pendingEditRequestId ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{ui.editPendingNote}</p>
                      ) : null}
                      {!row.pendingEditRequestId && row.latestEditRejectionReason ? (
                        <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                          {ui.editRejectedReasonLabel}: {row.latestEditRejectionReason}
                        </p>
                      ) : null}
                      {(row.status === "DRAFT" || row.status === "ON_HOLD" || row.status === "REJECTED") && (
                        <button type="button" onClick={() => void submitForReview(row)} className="text-xs text-link underline">
                          {ui.submitForReview}
                        </button>
                      )}
                      {row.status === "REJECTED" && row.latestProductRejectionReason ? (
                        <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                          {ui.productRejectedReasonLabel}: {row.latestProductRejectionReason}
                        </p>
                      ) : null}
                      {row.status === "REJECTED" ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{ui.rejectedNote}</p>
                      ) : null}
                      {row.status === "PUBLISHED" && (
                        <button type="button" onClick={() => void putOnHold(row)} className="text-xs text-[var(--muted)] underline">
                          {ui.putOnHold}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/vendor/products/${row.id}/edit`}
                        className="text-sm text-link font-medium"
                      >
                        {ui.edit}
                      </Link>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          {ui.delete}
                        </button>
                      ) : null}
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
