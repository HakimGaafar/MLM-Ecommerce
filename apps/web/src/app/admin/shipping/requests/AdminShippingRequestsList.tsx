"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";
type Tab = "pending" | "approved" | "rejected";

type Row = {
  id: string;
  vendorId: string;
  storeName: string;
  requestedMode: string;
  requestedIndirect: string | null;
  requestedFee: string;
  requestedNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type Ui = Record<string, string>;

export default function AdminShippingRequestsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/shipping/requests?tab=${tab}&page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
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
  }, [tab, page, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const body =
        action === "reject"
          ? { action, rejectionReason: ui.defaultRejectReason }
          : { action };
      const res = await fetch(`/api/v1/admin/shipping/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(ui.toastError);
      toast.success(action === "approve" ? ui.toastApproved : ui.toastRejected);
      await load();
    } catch {
      toast.error(ui.toastError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div dir={direction} className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-[var(--foreground)] text-[var(--background)]" : "border border-[var(--border)]"}`}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {ui[`tab${t[0].toUpperCase()}${t.slice(1)}` as keyof Ui] ?? t}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-[var(--muted)]">{ui.empty}</p> : null}
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] p-4 text-sm">
            <p className="font-medium">{row.storeName}</p>
            <p className="mt-1 text-[var(--muted)]">
              {row.requestedMode}
              {row.requestedIndirect ? ` / ${row.requestedIndirect}` : ""} — {formatMoney(row.requestedFee, "SAR", locale)}
            </p>
            {row.requestedNotes ? <p className="mt-2 text-[var(--muted)]">{row.requestedNotes}</p> : null}
            {tab === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-primary btn-press text-xs" disabled={busyId === row.id} onClick={() => void review(row.id, "approve")}>
                  {ui.approve}
                </button>
                <button type="button" className="btn-secondary btn-press text-xs" disabled={busyId === row.id} onClick={() => void review(row.id, "reject")}>
                  {ui.reject}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        pageSize={LIST_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        labels={getPaginationLabels(locale)}
      />
    </div>
  );
}
