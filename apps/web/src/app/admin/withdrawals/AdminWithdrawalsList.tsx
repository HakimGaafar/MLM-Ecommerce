"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import MarkWithdrawalPaidDialog from "@/components/admin/MarkWithdrawalPaidDialog";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { statusLabel } from "@/lib/status-label";

type Locale = "en" | "ar";

type Row = {
  id: string;
  userName: string;
  userEmail: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  bankReference: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  user: string;
  amount: string;
  status: string;
  requested: string;
  paid: string;
  bankReference: string;
  approve: string;
  decline: string;
  markPaid: string;
  actionError: string;
  filterPending: string;
  filterApproved: string;
  filterDeclined: string;
  declineTitle: string;
  declineMessage: string;
  declineConfirm: string;
  declineCancel: string;
  markPaidTitle: string;
  markPaidMessage: string;
  markPaidReference: string;
  markPaidReferencePlaceholder: string;
  markPaidConfirm: string;
  markPaidCancel: string;
  markPaidSubmitting: string;
  statusLabels: Record<string, string>;
};

export default function AdminWithdrawalsList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "DECLINED">("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Row | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/withdrawals?page=${page}&pageSize=${pageSize}&scope=affiliate&status=${statusFilter}`,
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
  }, [page, pageSize, statusFilter, ui.loadError]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    id: string,
    action: "approve" | "decline" | "mark_paid",
    bankReference?: string,
  ) => {
    setActingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/withdrawals/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(bankReference ? { bankReference } : {}) }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.actionError);
      }
      setDeclineTarget(null);
      setMarkPaidTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.actionError);
    } finally {
      setActingId(null);
    }
  };

  if (loading && items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <div className="space-y-4" dir={direction}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={statusFilter === "PENDING" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          onClick={() => setStatusFilter("PENDING")}
        >
          {ui.filterPending}
        </button>
        <button
          type="button"
          className={statusFilter === "APPROVED" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          onClick={() => setStatusFilter("APPROVED")}
        >
          {ui.filterApproved}
        </button>
        <button
          type="button"
          className={statusFilter === "DECLINED" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          onClick={() => setStatusFilter("DECLINED")}
        >
          {ui.filterDeclined}
        </button>
      </div>

      {error ? <p className="app-alert-error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          {ui.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[44rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.user}</th>
                <th className="px-4 py-3 font-medium">{ui.amount}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium">{ui.requested}</th>
                <th className="px-4 py-3 font-medium">{ui.paid}</th>
                <th className="px-4 py-3 font-medium">{ui.bankReference}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.userName}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.userEmail}</span>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {formatMoney(row.amount, row.currency, locale)}
                  </td>
                  <td className="px-4 py-3">{statusLabel(row.status, ui.statusLabels)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted)]">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {row.paidAt ? new Date(row.paidAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {row.bankReference ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            className="btn-primary text-xs"
                            onClick={() => void runAction(row.id, "approve")}
                          >
                            {ui.approve}
                          </button>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            className="btn-secondary text-xs"
                            onClick={() => setDeclineTarget(row)}
                          >
                            {ui.decline}
                          </button>
                        </>
                      ) : null}
                      {row.status === "APPROVED" && !row.paidAt ? (
                        <button
                          type="button"
                          disabled={actingId === row.id}
                          className="btn-secondary text-xs"
                          onClick={() => setMarkPaidTarget(row)}
                        >
                          {ui.markPaid}
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

      <ConfirmDialog
        open={declineTarget !== null}
        title={ui.declineTitle}
        message={ui.declineMessage.replace("{user}", declineTarget?.userName ?? "")}
        confirmLabel={ui.declineConfirm}
        cancelLabel={ui.declineCancel}
        confirming={actingId === declineTarget?.id}
        onConfirm={() => {
          if (declineTarget) void runAction(declineTarget.id, "decline");
        }}
        onCancel={() => setDeclineTarget(null)}
      />

      <MarkWithdrawalPaidDialog
        open={markPaidTarget !== null}
        userName={markPaidTarget?.userName ?? ""}
        amount={markPaidTarget ? formatMoney(markPaidTarget.amount, markPaidTarget.currency, locale) : ""}
        currency={markPaidTarget?.currency ?? "SAR"}
        locale={locale}
        title={ui.markPaidTitle}
        message={ui.markPaidMessage}
        referenceLabel={ui.markPaidReference}
        referencePlaceholder={ui.markPaidReferencePlaceholder}
        confirmLabel={ui.markPaidConfirm}
        cancelLabel={ui.markPaidCancel}
        confirming={actingId === markPaidTarget?.id}
        confirmingLabel={ui.markPaidSubmitting}
        onConfirm={(bankReference) => {
          if (markPaidTarget) void runAction(markPaidTarget.id, "mark_paid", bankReference);
        }}
        onCancel={() => setMarkPaidTarget(null)}
      />
    </div>
  );
}
