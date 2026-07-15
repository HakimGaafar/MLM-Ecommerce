"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Locale = "en" | "ar";
type ScopeTab = "vendor" | "customer";

type DocRow = {
  id: string;
  subjectType: string;
  documentType: string;
  status: string;
  originalFileName: string;
  documentExpiresAt: string | null;
  expiryWarning: string;
  submittedAt: string | null;
  updateRequestedAt: string | null;
  ibanNumber: string | null;
};

type SubjectGroup = {
  subjectKey: string;
  subjectType: string;
  subjectLabel: string;
  subjectEmail: string | null;
  documents: DocRow[];
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  tabVendor: string;
  tabCustomer: string;
  searchPlaceholder: string;
  expand: string;
  collapse: string;
  approve: string;
  reject: string;
  viewFile: string;
  copyEmail: string;
  copyEmailSuccess: string;
  copyEmailError: string;
  requestUpdate: string;
  requestUpdateBulk: string;
  requestUpdateSuccess: string;
  requestUpdateError: string;
  updatePendingBadge: string;
  verifiedBadge: string;
  pendingReviewBadge: string;
  toastApproved: string;
  toastRejected: string;
  toastError: string;
  defaultRejectReason: string;
  defaultUpdateMessage: string;
  expiryMonth: string;
  expiryWeek: string;
  selectAll: string;
  clearSelection: string;
  documentTypes: Record<string, string>;
  statusLabels: Record<string, string>;
  subjectTypes: Record<string, string>;
};

function expiryChipClass(warning: string): string {
  if (warning === "week") return "border-red-500/50 bg-red-500/15 text-red-200";
  if (warning === "month") return "border-amber-500/50 bg-amber-500/15 text-amber-200";
  return "";
}

export default function AdminKycGroupedList({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [scope, setScope] = useState<ScopeTab>("vendor");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/v1/admin/kyc/subjects?scope=${scope}${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { groups: SubjectGroup[] };
      setGroups(data.groups);
      setOpenKey(null);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [scope, search, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  };

  const expiryLabel = (warning: string) => {
    if (warning === "week") return ui.expiryWeek;
    if (warning === "month") return ui.expiryMonth;
    return null;
  };

  const statusBadge = (doc: DocRow) => {
    if (doc.updateRequestedAt) {
      return (
        <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
          {ui.updatePendingBadge}
        </span>
      );
    }
    if (doc.status === "ACCEPTED") {
      return (
        <span className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">
          {ui.verifiedBadge}
        </span>
      );
    }
    if (doc.status === "PENDING_REVIEW") {
      return (
        <span className="rounded-full border border-sky-500/50 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-200">
          {ui.pendingReviewBadge}
        </span>
      );
    }
    return (
      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
        {ui.statusLabels[doc.status] ?? doc.status}
      </span>
    );
  };

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

  async function copyEmail(email: string | null) {
    if (!email) {
      toast.error(ui.copyEmailError);
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      toast.success(ui.copyEmailSuccess);
    } catch {
      toast.error(ui.copyEmailError);
    }
  }

  async function requestUpdate(documentIds: string[]) {
    if (documentIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/v1/admin/kyc/documents/request-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentIds, message: ui.defaultUpdateMessage }),
      });
      if (!res.ok) throw new Error(ui.requestUpdateError);
      toast.success(ui.requestUpdateSuccess);
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.requestUpdateError);
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleOpen(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selectedIds.size;
  const bulkLabel = useMemo(
    () => ui.requestUpdateBulk.replace("{count}", String(selectedCount)),
    [selectedCount, ui.requestUpdateBulk],
  );

  return (
    <div dir={direction} className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${scope === "vendor" ? "bg-[var(--foreground)] text-[var(--background)]" : "border border-[var(--border)]"}`}
          onClick={() => setScope("vendor")}
        >
          {ui.tabVendor}
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${scope === "customer" ? "bg-[var(--foreground)] text-[var(--background)]" : "border border-[var(--border)]"}`}
          onClick={() => setScope("customer")}
        >
          {ui.tabCustomer}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ui.searchPlaceholder}
          className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        {selectedCount > 0 ? (
          <>
            <button
              type="button"
              className="btn-primary btn-press text-xs"
              disabled={bulkBusy}
              onClick={() => void requestUpdate([...selectedIds])}
            >
              {bulkLabel}
            </button>
            <button
              type="button"
              className="btn-secondary btn-press text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              {ui.clearSelection}
            </button>
          </>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && groups.length === 0 ? <p className="text-sm text-[var(--muted)]">{ui.empty}</p> : null}

      <ul className="space-y-3">
        {groups.map((group) => {
          const open = openKey === group.subjectKey;
          const groupDocIds = group.documents.map((d) => d.id);
          const allSelected = groupDocIds.length > 0 && groupDocIds.every((id) => selectedIds.has(id));

          return (
            <li key={group.subjectKey} className="rounded-xl border border-[var(--border)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                onClick={() => toggleOpen(group.subjectKey)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{group.subjectLabel}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {ui.subjectTypes[group.subjectType] ?? group.subjectType}
                    {group.subjectEmail ? ` · ${group.subjectEmail}` : ""}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted)]">{open ? ui.collapse : ui.expand}</span>
              </button>

              {open ? (
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-press text-xs"
                      onClick={() => void copyEmail(group.subjectEmail)}
                    >
                      {ui.copyEmail}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-press text-xs"
                      disabled={groupDocIds.length === 0}
                      onClick={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (allSelected) groupDocIds.forEach((id) => next.delete(id));
                          else groupDocIds.forEach((id) => next.add(id));
                          return next;
                        });
                      }}
                    >
                      {allSelected ? ui.clearSelection : ui.selectAll}
                    </button>
                  </div>

                  <ul className="space-y-3">
                    {group.documents.map((doc) => {
                      const expLabel = expiryLabel(doc.expiryWarning);
                      return (
                        <li
                          key={doc.id}
                          className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--surface))] p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedIds.has(doc.id)}
                              onChange={() => toggleSelect(doc.id)}
                              aria-label={ui.documentTypes[doc.documentType] ?? doc.documentType}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {ui.documentTypes[doc.documentType] ?? doc.documentType}
                                </p>
                                {statusBadge(doc)}
                                {expLabel ? (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${expiryChipClass(doc.expiryWarning)}`}
                                  >
                                    {expLabel}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-[var(--muted)]">{doc.originalFileName}</p>
                              {doc.documentExpiresAt ? (
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {formatDate(doc.documentExpiresAt)}
                                </p>
                              ) : null}
                              {doc.ibanNumber ? (
                                <p className="mt-1 font-mono text-xs">{doc.ibanNumber}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 ps-7">
                            <a
                              href={`/api/v1/admin/kyc/documents/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary btn-press text-xs"
                            >
                              {ui.viewFile}
                            </a>
                            <button
                              type="button"
                              className="btn-secondary btn-press text-xs"
                              onClick={() => void requestUpdate([doc.id])}
                              disabled={bulkBusy}
                            >
                              {ui.requestUpdate}
                            </button>
                            {doc.status === "PENDING_REVIEW" ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-primary btn-press text-xs"
                                  disabled={busyId === doc.id}
                                  onClick={() => void review(doc.id, "accept")}
                                >
                                  {ui.approve}
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary btn-press border-red-500/60 text-xs text-red-200"
                                  disabled={busyId === doc.id}
                                  onClick={() => void review(doc.id, "reject")}
                                >
                                  {ui.reject}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
