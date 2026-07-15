"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { statusLabel } from "@/lib/status-label";

type Locale = "en" | "ar";

type WalletSummary = {
  currency: string;
  availableBalance: string;
  pendingBalance: string;
  lockedBalance: string;
};

type TxRow = {
  id: string;
  entryType: string;
  direction: string;
  amount: string;
  status: string;
  createdAt: string;
  referenceType?: string;
  meta?: Record<string, unknown> | null;
};

type Ui = {
  loading: string;
  loadError: string;
  available: string;
  pending: string;
  locked: string;
  payInTitle: string;
  payoutTitle: string;
  emptyPayIn: string;
  emptyPayout: string;
  colDate: string;
  colType: string;
  colAmount: string;
  colStatus: string;
  entryTypeLabels: Record<string, string>;
  kindLabels: Record<string, string>;
  reversedHint: string;
  orderRef: string;
  statusLabels: Record<string, string>;
};

function formatOrderRef(template: string, orderNo: string) {
  return template.replace("{orderNo}", orderNo);
}

export default function VendorPayoutView({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [payIns, setPayIns] = useState<TxRow[]>([]);
  const [payInPage, setPayInPage] = useState(1);
  const [payInTotal, setPayInTotal] = useState(0);
  const [payouts, setPayouts] = useState<TxRow[]>([]);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);

  const loadWallet = useCallback(async () => {
    const res = await fetch("/api/v1/vendor/wallet", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(ui.loadError);
    return (await res.json()) as WalletSummary;
  }, [ui.loadError]);

  const loadPayIns = useCallback(async () => {
    const res = await fetch(
      `/api/v1/vendor/wallet/transactions?kind=pay_in&page=${payInPage}&pageSize=${pageSize}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) throw new Error(ui.loadError);
    const data = (await res.json()) as { items: TxRow[]; total: number };
    setPayIns(data.items);
    setPayInTotal(data.total);
  }, [payInPage, pageSize, ui.loadError]);

  const loadPayouts = useCallback(async () => {
    const res = await fetch(
      `/api/v1/vendor/wallet/transactions?kind=payout&page=${payoutPage}&pageSize=${pageSize}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) throw new Error(ui.loadError);
    const data = (await res.json()) as { items: TxRow[]; total: number };
    setPayouts(data.items);
    setPayoutTotal(data.total);
  }, [payoutPage, pageSize, ui.loadError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const wallet = await loadWallet();
        if (cancelled) return;
        setSummary(wallet);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWallet, ui.loadError]);

  useEffect(() => {
    void loadPayIns().catch((e) => setError(e instanceof Error ? e.message : ui.loadError));
  }, [loadPayIns, ui.loadError]);

  useEffect(() => {
    void loadPayouts().catch((e) => setError(e instanceof Error ? e.message : ui.loadError));
  }, [loadPayouts, ui.loadError]);

  function rowTypeLabel(row: TxRow) {
    const kind = typeof row.meta?.kind === "string" ? row.meta.kind : null;
    if (kind && ui.kindLabels[kind]) {
      return ui.kindLabels[kind];
    }
    return ui.entryTypeLabels[row.entryType] ?? row.entryType;
  }

  function rowSubLabel(row: TxRow) {
    const orderNo = typeof row.meta?.orderNo === "string" ? row.meta.orderNo.trim() : "";
    if (orderNo) {
      return formatOrderRef(ui.orderRef, orderNo);
    }
    if (row.status === "REVERSED") {
      return ui.reversedHint;
    }
    return null;
  }

  function renderTable(rows: TxRow[], empty: string) {
    if (rows.length === 0) {
      return <p className="text-sm text-[var(--muted)]">{empty}</p>;
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
            <tr>
              <th className="px-3 py-2 font-medium">{ui.colDate}</th>
              <th className="px-3 py-2 font-medium">{ui.colType}</th>
              <th className="px-3 py-2 font-medium">{ui.colAmount}</th>
              <th className="px-3 py-2 font-medium">{ui.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isReversed = row.status === "REVERSED";
              const isReturnReversal =
                row.meta?.kind === "vendor_earning_reversal" || row.referenceType === "order_return";
              const subLabel = rowSubLabel(row);

              return (
                <tr
                  key={row.id}
                  className={[
                    "border-b border-[var(--table-row-border)]",
                    isReversed ? "bg-[var(--table-head-bg)]/40 opacity-75" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {new Date(row.createdAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={isReversed ? "text-[var(--muted)]" : ""}>{rowTypeLabel(row)}</span>
                    {subLabel ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{subLabel}</p>
                    ) : null}
                  </td>
                  <td
                    className={[
                      "px-3 py-2 tabular-nums font-medium",
                      isReversed ? "text-[var(--muted)] line-through decoration-[var(--muted)]" : "",
                      isReturnReversal && !isReversed ? "text-amber-700 dark:text-amber-400" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.direction === "CREDIT" ? "+" : "-"}
                    {formatMoney(row.amount, summary?.currency ?? "SAR", locale)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        isReversed
                          ? "rounded-full bg-[var(--table-head-bg)] px-2 py-0.5 text-[var(--muted)]"
                          : ""
                      }
                    >
                      {statusLabel(row.status, ui.statusLabels)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  return (
    <div className="space-y-8" dir={direction}>
      {error ? (
        <p className="app-alert-error">{error}</p>
      ) : null}
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{ui.available}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.availableBalance, summary.currency, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{ui.pending}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.pendingBalance, summary.currency, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{ui.locked}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.lockedBalance, summary.currency, locale)}
            </p>
          </div>
        </div>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold">{ui.payInTitle}</h2>
        <div className="mt-3 space-y-3">
          {renderTable(payIns, ui.emptyPayIn)}
          {payIns.length > 0 ? (
            <Pagination
              page={payInPage}
              total={payInTotal}
              pageSize={pageSize}
              onPageChange={setPayInPage}
              labels={getPaginationLabels(locale)}
            />
          ) : null}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">{ui.payoutTitle}</h2>
        <div className="mt-3 space-y-3">
          {renderTable(payouts, ui.emptyPayout)}
          {payouts.length > 0 ? (
            <Pagination
              page={payoutPage}
              total={payoutTotal}
              pageSize={pageSize}
              onPageChange={setPayoutPage}
              labels={getPaginationLabels(locale)}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
