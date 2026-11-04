"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Invoice = {
  id: string;
  vendorId: string;
  amountReceived: string;
  currency: string;
  orderNosText: string;
  fileStorageKey: string;
  fileOriginalName: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  withdrawalAmount: string;
  paidAt: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  filterAll: string;
  filterPending: string;
  filterNeedsFix: string;
  filterAccepted: string;
  amountReceived: string;
  withdrawalAmount: string;
  orderNos: string;
  paidAt: string;
  status: string;
  openFile: string;
  accept: string;
  needsFix: string;
  reviewNote: string;
  reviewNotePlaceholder: string;
  updating: string;
  updateError: string;
};

export default function AdminPayoutInvoicesList({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [filter, setFilter] = useState<"ALL" | "PENDING_REVIEW" | "NEEDS_FIX" | "ACCEPTED">(
    "PENDING_REVIEW",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Invoice[]>([]);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/v1/admin/payout-invoices${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: Invoice[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, status: "ACCEPTED" | "NEEDS_FIX") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/payout-invoices/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: noteById[id]?.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? ui.updateError);
      toast.success(toastDict.saved);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : ui.updateError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["PENDING_REVIEW", ui.filterPending],
            ["NEEDS_FIX", ui.filterNeedsFix],
            ["ACCEPTED", ui.filterAccepted],
            ["ALL", ui.filterAll],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={
              filter === key ? "btn-primary text-sm" : "btn-secondary text-sm"
            }
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">{ui.loading}</p> : null}
      {error ? <p className="app-alert-error">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : null}

      <ul className="space-y-4">
        {items.map((inv) => (
          <li
            key={inv.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">
                  {ui.amountReceived}:{" "}
                  <span className="tabular-nums">
                    {formatMoney(inv.amountReceived, inv.currency, locale)}
                  </span>
                </p>
                <p className="text-[var(--muted)]">
                  {ui.withdrawalAmount}:{" "}
                  {formatMoney(inv.withdrawalAmount, inv.currency, locale)}
                </p>
                <p className="text-[var(--muted)]">
                  {ui.paidAt}:{" "}
                  {inv.paidAt
                    ? new Date(inv.paidAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-SA")
                    : "—"}
                </p>
                <p>
                  {ui.status}: <span className="font-medium">{inv.status}</span>
                </p>
              </div>
              {inv.fileStorageKey && !inv.fileStorageKey.includes("://") ? (
                <a
                  href={`/api/v1/admin/payout-invoices/file?key=${encodeURIComponent(inv.fileStorageKey)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link font-medium"
                >
                  {ui.openFile}
                  {inv.fileOriginalName ? ` (${inv.fileOriginalName})` : ""}
                </a>
              ) : (
                <span className="text-[var(--muted)]">{ui.openFile}: —</span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">{ui.orderNos}: </span>
              {inv.orderNosText}
            </p>
            {inv.status === "PENDING_REVIEW" || inv.status === "NEEDS_FIX" ? (
              <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                <label className="block space-y-1">
                  <span className="font-medium">{ui.reviewNote}</span>
                  <textarea
                    className="app-input min-h-16 w-full max-w-xl"
                    value={noteById[inv.id] ?? ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [inv.id]: e.target.value }))
                    }
                    placeholder={ui.reviewNotePlaceholder}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === inv.id}
                    onClick={() => void review(inv.id, "ACCEPTED")}
                  >
                    {busyId === inv.id ? ui.updating : ui.accept}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === inv.id}
                    onClick={() => void review(inv.id, "NEEDS_FIX")}
                  >
                    {ui.needsFix}
                  </button>
                </div>
              </div>
            ) : inv.reviewNote ? (
              <p className="mt-3 text-[var(--muted)]">
                {ui.reviewNote}: {inv.reviewNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
