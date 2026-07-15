"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";
type Tab = "pending" | "accepted" | "rejected";

type Row = {
  id: string;
  subjectType: string;
  documentType: string;
  status: string;
  subjectLabel: string;
  subjectEmail: string | null;
  originalFileName: string;
  documentExpiresAt: string | null;
  ibanNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  tabPending: string;
  tabAccepted: string;
  tabRejected: string;
  approve: string;
  reject: string;
  viewFile: string;
  toastApproved: string;
  toastRejected: string;
  toastError: string;
  defaultRejectReason: string;
  subject: string;
  document: string;
  status: string;
  submitted: string;
  documentTypes: Record<string, string>;
  statusLabels: Record<string, string>;
  subjectTypes: Record<string, string>;
};

export default function AdminKycList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/kyc/documents?tab=${tab}&page=${page}&pageSize=${LIST_PAGE_SIZE}`,
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
  }, [tab, page, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "accept" | "reject") {
    setBusyId(id);
    try {
      const body =
        action === "reject"
          ? { action, rejectionReason: ui.defaultRejectReason }
          : { action };
      const res = await fetch(`/api/v1/admin/kyc/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(ui.toastError);
      toast.success(action === "accept" ? ui.toastApproved : ui.toastRejected);
      await load();
    } catch {
      toast.error(ui.toastError);
    } finally {
      setBusyId(null);
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  };

  return (
    <div dir={direction} className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "accepted", "rejected"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-[var(--foreground)] text-[var(--background)]" : "border border-[var(--border)]"}`}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {(ui[`tab${t[0].toUpperCase()}${t.slice(1)}` as keyof Ui] as string) ?? t}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-[var(--muted)]">{ui.empty}</p> : null}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] p-4 text-sm">
            <p className="font-medium">{row.subjectLabel}</p>
            {row.subjectEmail ? <p className="text-xs text-[var(--muted)]">{row.subjectEmail}</p> : null}
            <p className="mt-2 text-[var(--muted)]">
              {ui.subjectTypes[row.subjectType] ?? row.subjectType} ·{" "}
              {ui.documentTypes[row.documentType] ?? row.documentType}
            </p>
            <p className="mt-1">
              {ui.status}: {ui.statusLabels[row.status] ?? row.status}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              {ui.submitted}: {formatDate(row.submittedAt)}
            </p>
            {row.ibanNumber ? <p className="mt-1 font-mono text-xs">IBAN: {row.ibanNumber}</p> : null}
            {row.documentExpiresAt ? (
              <p className="mt-1 text-xs text-[var(--muted)]">Expiry: {formatDate(row.documentExpiresAt)}</p>
            ) : null}
            {row.rejectionReason ? (
              <p className="mt-2 text-red-400">{row.rejectionReason}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/api/v1/admin/kyc/documents/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-press text-xs"
              >
                {ui.viewFile}
              </a>
              {tab === "pending" ? (
                <>
                  <button
                    type="button"
                    className="btn-primary btn-press text-xs"
                    disabled={busyId === row.id}
                    onClick={() => void review(row.id, "accept")}
                  >
                    {ui.approve}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-press text-xs border-red-500/60 text-red-200"
                    disabled={busyId === row.id}
                    onClick={() => void review(row.id, "reject")}
                  >
                    {ui.reject}
                  </button>
                </>
              ) : null}
            </div>
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
