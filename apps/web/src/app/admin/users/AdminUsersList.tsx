"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { statusLabel } from "@/lib/status-label";

type Locale = "en" | "ar";

type Row = {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  name: string;
  email: string;
  roles: string;
  status: string;
  created: string;
  actions: string;
  promote: string;
  promoting: string;
  promoteSuccess: string;
  promoteError: string;
  alreadyAdmin: string;
  demote: string;
  demoting: string;
  demoteSuccess: string;
  demoteError: string;
  notAdmin: string;
  cannotDemoteSuperAdmin: string;
  prev: string;
  next: string;
  pageOf: string;
  statusLabels: Record<string, string>;
};

export default function AdminUsersList({
  locale,
  ui,
  canPromote,
  currentUserId,
}: {
  locale: Locale;
  ui: Ui;
  canPromote: boolean;
  currentUserId: string;
}) {
  const toast = useToast();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [demotingId, setDemotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users?page=${page}&pageSize=${pageSize}`, {
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

  async function onPromote(userId: string) {
    setPromotingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/promote`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        user?: Row;
      } | null;
      if (!res.ok) {
        if (payload?.code === "ALREADY_ADMIN") throw new Error(ui.alreadyAdmin);
        throw new Error(payload?.error ?? ui.promoteError);
      }
      toast.success(ui.promoteSuccess);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.promoteError;
      setError(msg);
      toast.error(msg);
    } finally {
      setPromotingId(null);
    }
  }

  async function onDemote(userId: string) {
    setDemotingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/demote`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      if (!res.ok) {
        if (payload?.code === "NOT_ADMIN") throw new Error(ui.notAdmin);
        if (payload?.code === "CANNOT_DEMOTE_SUPER_ADMIN") throw new Error(ui.cannotDemoteSuperAdmin);
        throw new Error(payload?.error ?? ui.demoteError);
      }
      toast.success(ui.demoteSuccess);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.demoteError;
      setError(msg);
      toast.error(msg);
    } finally {
      setDemotingId(null);
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
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
              <tr>
                <th className="px-4 py-3 font-medium">{ui.name}</th>
                <th className="px-4 py-3 font-medium">{ui.email}</th>
                <th className="px-4 py-3 font-medium">{ui.roles}</th>
                <th className="px-4 py-3 font-medium">{ui.status}</th>
                <th className="px-4 py-3 font-medium">{ui.created}</th>
                {canPromote ? <th className="px-4 py-3 font-medium">{ui.actions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isAdmin = row.roles.includes("ADMIN");
                const isSuperAdmin = row.roles.includes("SUPER_ADMIN");
                const showPromote =
                  canPromote && row.id !== currentUserId && !isAdmin && row.status === "ACTIVE";
                const showDemote = canPromote && isAdmin && !isSuperAdmin;
                return (
                  <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.email}</td>
                    <td className="px-4 py-3 text-xs">{row.roles.join(", ")}</td>
                    <td className="px-4 py-3">{statusLabel(row.status, ui.statusLabels)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    {canPromote ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-3">
                          {showPromote ? (
                            <button
                              type="button"
                              className="text-sm font-medium text-link disabled:opacity-50"
                              disabled={promotingId === row.id || demotingId === row.id}
                              onClick={() => void onPromote(row.id)}
                            >
                              {promotingId === row.id ? ui.promoting : ui.promote}
                            </button>
                          ) : null}
                          {showDemote ? (
                            <button
                              type="button"
                              className="text-sm font-medium text-red-600 dark:text-red-400 disabled:opacity-50"
                              disabled={demotingId === row.id || promotingId === row.id}
                              onClick={() => void onDemote(row.id)}
                            >
                              {demotingId === row.id ? ui.demoting : ui.demote}
                            </button>
                          ) : null}
                          {!showPromote && !showDemote ? (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
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
