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
  storeApprovalStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  setupComplete: boolean;
  kycApproved: boolean;
  canSell: boolean;
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
  status: string;
  readiness: string;
  permissions: string;
  approve: string;
  reject: string;
  suspend: string;
  pending: string;
  approved: string;
  rejected: string;
  suspended: string;
  setupOk: string;
  setupMissing: string;
  kycOk: string;
  kycMissing: string;
  actionError: string;
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
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function setStatus(id: string, status: Row["storeApprovalStatus"]) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/vendors/${id}/store-approval`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; vendor?: Row } | null;
      if (!res.ok) throw new Error(payload?.error ?? ui.actionError);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.actionError);
    } finally {
      setBusyId(null);
    }
  }

  function statusLabel(status: Row["storeApprovalStatus"]) {
    switch (status) {
      case "APPROVED":
        return ui.approved;
      case "REJECTED":
        return ui.rejected;
      case "SUSPENDED":
        return ui.suspended;
      default:
        return ui.pending;
    }
  }

  if (loading && items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && items.length === 0) {
    return <p className="app-alert-error">{error}</p>;
  }

  return (
    <div className="space-y-4" dir={direction}>
      {error ? <p className="app-alert-error">{error}</p> : null}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)] dark:border-[var(--border-strong)] dark:text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[44rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.store}</th>
                <th className="px-4 py-3 font-medium">{ui.owner}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium">{ui.readiness}</th>
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
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{statusLabel(row.storeApprovalStatus)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.storeApprovalStatus !== "APPROVED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id || !row.setupComplete || !row.kycApproved}
                          onClick={() => void setStatus(row.id, "APPROVED")}
                          className="text-xs text-link underline disabled:opacity-40"
                        >
                          {ui.approve}
                        </button>
                      ) : null}
                      {row.storeApprovalStatus !== "REJECTED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row.id, "REJECTED")}
                          className="text-xs text-red-600 underline disabled:opacity-40"
                        >
                          {ui.reject}
                        </button>
                      ) : null}
                      {row.storeApprovalStatus === "APPROVED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row.id, "SUSPENDED")}
                          className="text-xs text-[var(--muted)] underline disabled:opacity-40"
                        >
                          {ui.suspend}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    <p>{row.setupComplete ? ui.setupOk : ui.setupMissing}</p>
                    <p>{row.kycApproved ? ui.kycOk : ui.kycMissing}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.productCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/vendors/${row.id}/permissions`} className="text-link font-medium">
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
