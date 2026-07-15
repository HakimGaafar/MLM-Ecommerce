"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type Row = {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  rankTitle: string;
  directReferrals: number;
  commissionPending: string;
  commissionApproved: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  searchPlaceholder: string;
  name: string;
  code: string;
  rank: string;
  referrals: string;
  pending: string;
  approved: string;
  view: string;
  prev: string;
  next: string;
};

export default function AdminAffiliatesList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/v1/admin/affiliates?${q}`, {
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
  }, [page, pageSize, search, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      <input
        type="search"
        placeholder={ui.searchPlaceholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="app-input max-w-md"
      />
      {error ? <p className="app-alert-error">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.name}</th>
                <th className="px-4 py-3 font-medium">{ui.code}</th>
                <th className="px-4 py-3 font-medium">{ui.rank}</th>
                <th className="px-4 py-3 font-medium">{ui.referrals}</th>
                <th className="px-4 py-3 font-medium">{ui.pending}</th>
                <th className="px-4 py-3 font-medium">{ui.approved}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.userId} className="border-t border-[var(--table-row-border)]">
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.email}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.referralCode}</td>
                  <td className="px-4 py-3">{row.rankTitle}</td>
                  <td className="px-4 py-3 tabular-nums">{row.directReferrals}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.commissionPending, "SAR", locale)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(row.commissionApproved, "SAR", locale)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/affiliates/${row.userId}`} className="text-sm font-medium text-link">
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
