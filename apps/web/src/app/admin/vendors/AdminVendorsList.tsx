"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type Row = {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  store: string;
  owner: string;
  products: string;
  created: string;
  permissions: string;
  prev: string;
  next: string;
  pageOf: string;
};

export default function AdminVendorsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
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
      const res = await fetch(`/api/v1/admin/vendors?page=${page}&pageSize=${pageSize}`, {
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
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <table className="w-full min-w-[32rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.store}</th>
                <th className="px-4 py-3 font-medium">{ui.owner}</th>
                <th className="px-4 py-3 font-medium">{ui.products}</th>
                <th className="px-4 py-3 font-medium">{ui.created}</th>
                <th className="px-4 py-3 font-medium">{ui.permissions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                  <td className="px-4 py-3 font-medium">{row.storeName}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.ownerName}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.ownerEmail}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.productCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vendors/${row.id}/permissions`}
                      className="text-link font-medium"
                    >
                      {ui.permissions}
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
