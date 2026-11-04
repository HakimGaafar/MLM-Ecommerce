"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type PayoutRow = {
  withdrawalTransactionId: string;
  amount: string;
  currency: string;
  paidAt: string | null;
  hasInvoice: boolean;
  invoiceStatus: string | null;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  missingBanner: string;
  paidAt: string;
  amount: string;
  status: string;
  statusMissing: string;
  statusPending: string;
  statusAccepted: string;
  statusNeedsFix: string;
  upload: string;
  reupload: string;
  amountReceived: string;
  orderNos: string;
  orderNosHint: string;
  file: string;
  submit: string;
  submitting: string;
  cancel: string;
  uploadError: string;
};

function statusLabel(row: PayoutRow, ui: Ui): string {
  if (!row.hasInvoice) return ui.statusMissing;
  if (row.invoiceStatus === "ACCEPTED") return ui.statusAccepted;
  if (row.invoiceStatus === "NEEDS_FIX") return ui.statusNeedsFix;
  if (row.invoiceStatus === "PENDING_REVIEW") return ui.statusPending;
  return row.invoiceStatus ?? ui.statusMissing;
}

export default function VendorPayoutInvoicesView({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PayoutRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [orderNos, setOrderNos] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/vendor/payout-invoices", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const data = (await res.json()) as { items: PayoutRow[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingCount = items.filter((i) => !i.hasInvoice || i.invoiceStatus === "NEEDS_FIX").length;

  function openForm(row: PayoutRow) {
    setActiveId(row.withdrawalTransactionId);
    setAmountReceived(row.amount);
    setOrderNos("");
    setFile(null);
  }

  async function submit() {
    if (!activeId || !file) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/v1/vendor/payout-invoices/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const upBody = (await up.json().catch(() => null)) as {
        error?: string;
        fileStorageKey?: string;
        fileOriginalName?: string;
      } | null;
      if (!up.ok || !upBody?.fileStorageKey) {
        throw new Error(upBody?.error ?? ui.uploadError);
      }

      const amount = Number.parseFloat(amountReceived);
      const row = items.find((i) => i.withdrawalTransactionId === activeId);
      const res = await fetch("/api/v1/vendor/payout-invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawalTransactionId: activeId,
          amountReceived: amount,
          currency: row?.currency ?? "SAR",
          orderNosText: orderNos.trim(),
          fileStorageKey: upBody.fileStorageKey,
          fileOriginalName: upBody.fileOriginalName,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? ui.uploadError);
      toast.success(toastDict.saved);
      setActiveId(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.uploadError;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error) {
    return <p className="app-alert-error mt-8">{error}</p>;
  }

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      {missingCount > 0 ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {ui.missingBanner}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {items.map((row) => {
            const canUpload = !row.hasInvoice || row.invoiceStatus === "NEEDS_FIX";
            const open = activeId === row.withdrawalTransactionId;
            return (
              <li key={row.withdrawalTransactionId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium tabular-nums">
                      {formatMoney(row.amount, row.currency, locale)}
                    </p>
                    <p className="text-[var(--muted)]">
                      {ui.paidAt}:{" "}
                      {row.paidAt
                        ? new Date(row.paidAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-SA")
                        : "—"}
                    </p>
                    <p className="text-xs font-medium">{statusLabel(row, ui)}</p>
                  </div>
                  {canUpload ? (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => (open ? setActiveId(null) : openForm(row))}
                    >
                      {row.invoiceStatus === "NEEDS_FIX" ? ui.reupload : ui.upload}
                    </button>
                  ) : null}
                </div>

                {open ? (
                  <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{ui.amountReceived}</span>
                      <input
                        className="app-input"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{ui.file}</span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,application/pdf"
                        className="app-input"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="block space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">{ui.orderNos}</span>
                      <textarea
                        className="app-input min-h-20"
                        value={orderNos}
                        onChange={(e) => setOrderNos(e.target.value)}
                        placeholder={ui.orderNosHint}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={submitting || !file || !orderNos.trim() || !amountReceived}
                        onClick={() => void submit()}
                      >
                        {submitting ? ui.submitting : ui.submit}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={submitting}
                        onClick={() => setActiveId(null)}
                      >
                        {ui.cancel}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
