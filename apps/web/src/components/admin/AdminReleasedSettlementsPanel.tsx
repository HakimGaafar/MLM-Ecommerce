"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

export type ReleasedSettlementRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  entryType: string;
  amount: string;
  currency: string;
  createdAt: string;
  releasedAt: string;
  releasedByUserId: string | null;
  releasedByUserName: string | null;
  settlementMethod: string | null;
  displaySource: string | null;
  vendorStoreName: string | null;
  orderId: string | null;
};

export type AdminReleasedSettlementsUi = {
  title: string;
  hint: string;
  loading: string;
  loadError: string;
  empty: string;
  colUser: string;
  colType: string;
  colSource: string;
  colAmount: string;
  colCreated: string;
  colReleased: string;
  colReleasedBy: string;
  colMethod: string;
  filterAll: string;
  filterAffiliate: string;
  filterVendor: string;
  dateFrom: string;
  dateTo: string;
  applyFilters: string;
  entryTypeLabels: Record<string, string>;
  methodLabels: Record<string, string>;
  viewOrder: string;
  viewAffiliate: string;
  linkPending: string;
};

export default function AdminReleasedSettlementsPanel({
  locale,
  ui,
}: {
  locale: Locale;
  ui: AdminReleasedSettlementsUi;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<ReleasedSettlementRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [entryFilter, setEntryFilter] = useState<"all" | "AFFILIATE_COMMISSION" | "VENDOR_EARNING">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (entryFilter !== "all") params.set("entryType", entryFilter);
      if (appliedFrom) params.set("dateFrom", appliedFrom);
      if (appliedTo) params.set("dateTo", appliedTo);
      const res = await fetch(`/api/v1/admin/settlements/released?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: ReleasedSettlementRow[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, entryFilter, page, pageSize, ui.loadError]);

  useEffect(() => {
    setPage(1);
  }, [entryFilter, appliedFrom, appliedTo]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyDateFilters() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <section className="app-card space-y-4 p-5" dir={direction}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{ui.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.hint}</p>
          <Link href="/admin/settlements" className="mt-2 inline-block text-sm font-medium text-link">
            {ui.linkPending}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={entryFilter === "all" ? "btn-primary text-sm" : "btn-secondary text-sm"}
            onClick={() => setEntryFilter("all")}
          >
            {ui.filterAll}
          </button>
          <button
            type="button"
            className={
              entryFilter === "AFFILIATE_COMMISSION" ? "btn-primary text-sm" : "btn-secondary text-sm"
            }
            onClick={() => setEntryFilter("AFFILIATE_COMMISSION")}
          >
            {ui.filterAffiliate}
          </button>
          <button
            type="button"
            className={
              entryFilter === "VENDOR_EARNING" ? "btn-primary text-sm" : "btn-secondary text-sm"
            }
            onClick={() => setEntryFilter("VENDOR_EARNING")}
          >
            {ui.filterVendor}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="font-medium">{ui.dateFrom}</span>
          <input
            type="date"
            className="app-input"
            value={dateFrom}
            onChange={(ev) => setDateFrom(ev.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="font-medium">{ui.dateTo}</span>
          <input
            type="date"
            className="app-input"
            value={dateTo}
            onChange={(ev) => setDateTo(ev.target.value)}
          />
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={applyDateFilters}>
          {ui.applyFilters}
        </button>
      </div>

      {error ? <p className="app-alert-error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[56rem] text-start text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                <tr>
                  <th className="px-3 py-3 font-medium">{ui.colUser}</th>
                  <th className="px-3 py-3 font-medium">{ui.colType}</th>
                  <th className="px-3 py-3 font-medium">{ui.colSource}</th>
                  <th className="px-3 py-3 font-medium">{ui.colAmount}</th>
                  <th className="px-3 py-3 font-medium">{ui.colCreated}</th>
                  <th className="px-3 py-3 font-medium">{ui.colReleased}</th>
                  <th className="px-3 py-3 font-medium">{ui.colReleasedBy}</th>
                  <th className="px-3 py-3 font-medium">{ui.colMethod}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                    <td className="px-3 py-3">
                      <span className="font-medium">{row.userName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.userEmail}</span>
                      {row.vendorStoreName ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.vendorStoreName}</span>
                      ) : null}
                      {row.entryType === "AFFILIATE_COMMISSION" ? (
                        <Link
                          href={`/admin/affiliates/${row.userId}`}
                          className="mt-1 block text-xs font-medium text-link"
                        >
                          {ui.viewAffiliate}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {ui.entryTypeLabels[row.entryType] ?? row.entryType}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {row.displaySource ?? "—"}
                      {row.orderId ? (
                        <Link
                          href={`/admin/orders/${row.orderId}`}
                          className="mt-1 block text-xs font-medium text-link"
                        >
                          {ui.viewOrder}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-medium tabular-nums">
                      {formatMoney(row.amount, row.currency, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--muted)]">
                      {new Date(row.releasedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">
                      {row.releasedByUserName ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">
                      {row.settlementMethod
                        ? (ui.methodLabels[row.settlementMethod] ?? row.settlementMethod)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            labels={getPaginationLabels(locale)}
          />
        </>
      )}
    </section>
  );
}
