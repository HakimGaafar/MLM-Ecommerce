"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format-currency";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Row = {
  orderId: string;
  orderNo: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  totalAmount: string;
  currency: string;
  lineCount: number;
  vendorCount: number;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  orderNo: string;
  status: string;
  buyer: string;
  date: string;
  total: string;
  lines: string;
  vendors: string;
  view: string;
  prev: string;
  next: string;
  pageOf: string;
  statusLabels: Record<string, string>;
};

export default function AdminOrdersList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders?page=${page}&pageSize=${pageSize}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: Row[]; total: number; hasMore: boolean };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg || toastDict.genericError);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function statusLabel(s: string) {
    return ui.statusLabels[s] ?? s;
  }

  function formatOrderDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading && items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && items.length === 0) {
    return <p className="app-alert-error">{error}</p>;
  }

  return (
    <div className="space-y-4" dir={direction}>
      {error ? (
        <p className="app-alert-error">{error}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)] dark:border-[var(--border-strong)] dark:text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[44rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.orderNo}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium">{ui.buyer}</th>
                <th className="px-4 py-3 font-medium">{ui.date}</th>
                <th className="px-4 py-3 font-medium">{ui.total}</th>
                <th className="px-4 py-3 font-medium">{ui.lines}</th>
                <th className="px-4 py-3 font-medium">{ui.vendors}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.orderId} className="border-b border-[var(--table-row-border)]">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{row.orderNo}</td>
                  <td className="px-4 py-3">{statusLabel(row.status)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.buyerName}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.buyerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatOrderDate(row.createdAt)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.totalAmount, row.currency, locale)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.lineCount}</td>
                  <td className="px-4 py-3 tabular-nums">{row.vendorCount}</td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/admin/orders/${row.orderId}`}
                      className="text-sm text-link font-medium"
                    >
                      {ui.view}
                    </Link>
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
