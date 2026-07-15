"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { VENDOR_PERMISSION_UI_GROUPS, type VendorPermissionCode } from "@mlm/shared";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type MemberRow = {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  userName: string | null;
  permissions: VendorPermissionCode[];
  inviteLink?: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  inviteTitle: string;
  email: string;
  emailPlaceholder: string;
  permissions: string;
  sendInvite: string;
  sending: string;
  inviteSuccess: string;
  revoke: string;
  revoking: string;
  revokeSuccess: string;
  statusPending: string;
  statusActive: string;
  copyLink: string;
  copied: string;
  member: string;
};

const ASSIGNABLE_GROUPS = VENDOR_PERMISSION_UI_GROUPS.filter((g) => g.id !== "team");

export default function VendorTeamManager({
  locale,
  ui,
  canEdit,
}: {
  locale: Locale;
  ui: Ui;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState<MemberRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<VendorPermissionCode>>(
    () => new Set(["vendor:products:read", "vendor:orders:read"]),
  );
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/vendor/team?page=${page}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: MemberRow[]; total: number };
      setItems(data.items ?? []);
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

  function togglePermission(code: VendorPermissionCode) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || submitting || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/vendor/team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permissions: [...selected] }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      setEmail("");
      toast.success(ui.inviteSuccess);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ui.loadError);
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeMember(id: string) {
    if (!canEdit || revokingId) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/v1/vendor/team/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      toast.success(ui.revokeSuccess);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ui.loadError);
    } finally {
      setRevokingId(null);
    }
  }

  async function copyInviteLink(link: string) {
    const url = `${window.location.origin}${link}`;
    await navigator.clipboard.writeText(url);
    toast.success(ui.copied);
  }

  return (
    <div className="space-y-6">
      {canEdit ? (
        <form onSubmit={sendInvite} className="app-card space-y-4 p-4 sm:p-6">
          <h2 className="text-sm font-semibold">{ui.inviteTitle}</h2>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{ui.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={ui.emailPlaceholder}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-[var(--foreground)]">{ui.permissions}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {ASSIGNABLE_GROUPS.map((group) => (
                <div key={group.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs font-semibold uppercase text-[var(--muted)]">{group.id}</p>
                  <ul className="mt-2 space-y-1">
                    {group.permissions.map((p) => (
                      <li key={p.code}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected.has(p.code)}
                            onChange={() => togglePermission(p.code)}
                          />
                          <span className="font-mono text-xs">{p.code}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn-primary" disabled={submitting || !email.trim()}>
            {submitting ? ui.sending : ui.sendInvite}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="app-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.email}</p>
                  {row.userName ? (
                    <p className="text-sm text-[var(--muted)]">
                      {ui.member}: {row.userName}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.status === "ACTIVE"
                      ? "app-badge-success"
                      : "app-badge-warning"
                  }`}
                >
                  {row.status === "ACTIVE" ? ui.statusActive : ui.statusPending}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">{row.permissions.join(", ")}</p>
              {row.status === "PENDING" && row.inviteLink && canEdit ? (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                  onClick={() => void copyInviteLink(row.inviteLink!)}
                >
                  {ui.copyLink}
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="mt-3 block text-sm text-red-600 hover:underline"
                  disabled={revokingId === row.id}
                  onClick={() => void revokeMember(row.id)}
                >
                  {revokingId === row.id ? ui.revoking : ui.revoke}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
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
