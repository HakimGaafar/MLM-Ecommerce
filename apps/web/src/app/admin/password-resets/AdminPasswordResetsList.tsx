"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type AuditAction =
  | "RESET_REQUESTED"
  | "RESET_COMPLETED"
  | "CHANGE_NOTIFICATION_SENT"
  | "CHANGE_NOTIFICATION_FAILED";

type Row = {
  id: string;
  action: AuditAction;
  email: string;
  userId: string | null;
  userName: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  allActions: string;
  action: string;
  email: string;
  user: string;
  ip: string;
  when: string;
  requested: string;
  completed: string;
  notifySent: string;
  notifyFailed: string;
  previous: string;
  next: string;
  page: string;
  total: string;
};

const PAGE_SIZE = 20;

export default function AdminPasswordResetsList({
  locale,
  ui,
}: {
  locale: "en" | "ar";
  ui: Ui;
}) {
  const toast = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [action, setAction] = useState<"" | AuditAction>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const labels: Record<AuditAction, string> = {
    RESET_REQUESTED: ui.requested,
    RESET_COMPLETED: ui.completed,
    CHANGE_NOTIFICATION_SENT: ui.notifySent,
    CHANGE_NOTIFICATION_FAILED: ui.notifyFailed,
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (action) params.set("action", action);
      const response = await fetch(`/api/v1/admin/password-resets?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("load");
      const data = (await response.json()) as {
        items: Row[];
        total: number;
        hasMore: boolean;
      };
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {
      toast.error(ui.loadError);
      setItems([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [action, page, toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-6 space-y-4" lang={locale}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-[var(--muted)]" htmlFor="password-reset-action">
          {ui.action}
        </label>
        <select
          id="password-reset-action"
          className="app-input max-w-xs"
          value={action}
          onChange={(event) => {
            setPage(1);
            setAction(event.target.value as "" | AuditAction);
          }}
        >
          <option value="">{ui.allActions}</option>
          <option value="RESET_REQUESTED">{ui.requested}</option>
          <option value="RESET_COMPLETED">{ui.completed}</option>
          <option value="CHANGE_NOTIFICATION_SENT">{ui.notifySent}</option>
          <option value="CHANGE_NOTIFICATION_FAILED">{ui.notifyFailed}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{ui.when}</th>
                <th className="px-3 py-2 font-medium">{ui.action}</th>
                <th className="px-3 py-2 font-medium">{ui.email}</th>
                <th className="px-3 py-2 font-medium">{ui.user}</th>
                <th className="px-3 py-2 font-medium">{ui.ip}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                    {new Date(row.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}
                  </td>
                  <td className="px-3 py-2">{labels[row.action]}</td>
                  <td className="px-3 py-2" dir="ltr">
                    {row.email}
                  </td>
                  <td className="px-3 py-2">{row.userName ?? "—"}</td>
                  <td className="px-3 py-2" dir="ltr">
                    {row.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[var(--muted)]">
          {ui.page} {page} · {ui.total} {total}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary btn-press"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {ui.previous}
          </button>
          <button
            type="button"
            className="btn-secondary btn-press"
            disabled={!hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {ui.next}
          </button>
        </div>
      </div>
    </div>
  );
}
