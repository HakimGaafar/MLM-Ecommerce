"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

export type PendingSettlementRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  entryType: string;
  amount: string;
  currency: string;
  createdAt: string;
  displaySource: string | null;
  vendorStoreName: string | null;
  orderId: string | null;
};

export type AdminPendingSettlementsUi = {
  title: string;
  hint: string;
  loading: string;
  loadError: string;
  empty: string;
  colSelect: string;
  colUser: string;
  colType: string;
  colSource: string;
  colAmount: string;
  colDate: string;
  releaseSelected: string;
  releaseAll: string;
  releasing: string;
  releaseSuccess: string;
  releaseError: string;
  selectAll: string;
  filterAll: string;
  filterAffiliate: string;
  filterVendor: string;
  entryTypeLabels: Record<string, string>;
  viewAffiliate: string;
  viewOrder: string;
};

export default function AdminPendingSettlementsPanel({
  locale,
  ui,
  userId,
  compact,
}: {
  locale: Locale;
  ui: AdminPendingSettlementsUi;
  userId?: string;
  compact?: boolean;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<PendingSettlementRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [entryFilter, setEntryFilter] = useState<"all" | "AFFILIATE_COMMISSION" | "VENDOR_EARNING">(
    userId ? "AFFILIATE_COMMISSION" : "all",
  );
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (userId) params.set("userId", userId);
      if (entryFilter !== "all") params.set("entryType", entryFilter);
      const res = await fetch(`/api/v1/admin/settlements/pending?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: PendingSettlementRow[]; total: number };
      setItems(data.items);
      setTotal(data.total);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [entryFilter, page, pageSize, ui.loadError, userId]);

  useEffect(() => {
    setPage(1);
  }, [entryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const releaseIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/admin/settlements/release", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: ids }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        released?: string[];
        failed?: { id: string; error: string }[];
      } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.releaseError);
      const released = payload?.released?.length ?? 0;
      const failed = payload?.failed?.length ?? 0;
      if (failed > 0 && released === 0) {
        throw new Error(payload?.failed?.[0]?.error ?? ui.releaseError);
      }
      setSuccess(ui.releaseSuccess.replace("{count}", String(released)));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.releaseError);
    } finally {
      setActing(false);
    }
  };

  const releaseAllForUser = async () => {
    if (!userId) return;
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const entryTypes =
        entryFilter === "all" ? undefined : [entryFilter];
      const res = await fetch("/api/v1/admin/settlements/release-for-user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, entryTypes }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        released?: string[];
        failed?: { id: string; error: string }[];
      } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.releaseError);
      const released = payload?.released?.length ?? 0;
      setSuccess(ui.releaseSuccess.replace("{count}", String(released)));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.releaseError);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <section className={compact ? "space-y-3" : "app-card space-y-4 p-5"} dir={direction}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={compact ? "text-lg font-semibold" : "text-xl font-semibold"}>{ui.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.hint}</p>
        </div>
        {!userId ? (
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
        ) : null}
      </div>

      {error ? <p className="app-alert-error">{error}</p> : null}
      {success ? <p className="app-alert-success">{success}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={acting || selected.size === 0}
              className="btn-primary text-sm disabled:opacity-50"
              onClick={() => void releaseIds([...selected])}
            >
              {acting ? ui.releasing : ui.releaseSelected}
            </button>
            {userId ? (
              <button
                type="button"
                disabled={acting}
                className="btn-secondary text-sm disabled:opacity-50"
                onClick={() => void releaseAllForUser()}
              >
                {ui.releaseAll}
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[48rem] text-start text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={ui.selectAll}
                      checked={items.length > 0 && selected.size === items.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">{ui.colUser}</th>
                  <th className="px-3 py-3 font-medium">{ui.colType}</th>
                  <th className="px-3 py-3 font-medium">{ui.colSource}</th>
                  <th className="px-3 py-3 font-medium">{ui.colAmount}</th>
                  <th className="px-3 py-3 font-medium">{ui.colDate}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium">{row.userName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.userEmail}</span>
                      {row.vendorStoreName ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.vendorStoreName}</span>
                      ) : null}
                      {!userId && row.entryType === "AFFILIATE_COMMISSION" ? (
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
