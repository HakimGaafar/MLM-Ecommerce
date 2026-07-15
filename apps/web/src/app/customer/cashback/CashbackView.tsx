"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { statusLabel } from "@/lib/status-label";

type Locale = "en" | "ar";

type WalletSummary = {
  marketId: string;
  marketCode: string;
  currency: string;
  availableBalance: string;
  pendingBalance: string;
  lockedBalance: string;
  cashbackRatePercent: number;
  minWithdrawalAmount: string;
  withdrawKycApproved: boolean;
  withdrawIdExpired: boolean;
  otherMarkets: {
    marketId: string;
    marketCode: string;
    marketName: string;
    currency: string;
    availableBalance: string;
  }[];
};

type TxRow = {
  id: string;
  entryType: string;
  direction: string;
  amount: string;
  status: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
  displaySource: string | null;
};

type HistoryTab = "all" | "CASHBACK" | "AFFILIATE_COMMISSION";

type Ui = {
  loading: string;
  loadError: string;
  available: string;
  pending: string;
  locked: string;
  rulesTitle: string;
  rulesBody: string;
  rulesAffiliateTitle: string;
  rulesAffiliateBody: string;
  historyTitle: string;
  emptyHistory: string;
  colDate: string;
  colType: string;
  colAmount: string;
  colStatus: string;
  colReference: string;
  tabAll: string;
  tabCashback: string;
  tabAffiliate: string;
  withdrawTitle: string;
  withdrawHint: string;
  withdrawAmount: string;
  withdrawSubmit: string;
  withdrawSubmitting: string;
  withdrawSuccess: string;
  withdrawError: string;
  withdrawMinHint: string;
  withdrawBelowMin: string;
  kycRequiredBanner: string;
  kycExpiredBanner: string;
  kycLink: string;
  withdrawPaidHint: string;
  otherMarketsTitle: string;
  otherMarketsHint: string;
  entryTypeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  directionCredit: string;
  directionDebit: string;
};

export default function CashbackView({ locale, ui }: { locale: Locale; ui: Ui }) {
  const toast = useToast();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const pageSize = LIST_PAGE_SIZE;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/v1/customer/wallet", { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      const p = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(p?.error ?? ui.loadError);
    }
    return (await res.json()) as WalletSummary;
  }, [ui.loadError]);

  const loadTransactions = useCallback(async () => {
    const entryQuery = activeTab === "all" ? "" : `&entryType=${encodeURIComponent(activeTab)}`;
    const res = await fetch(
      `/api/v1/customer/wallet/transactions?page=${page}&pageSize=${pageSize}${entryQuery}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!res.ok) {
      const p = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(p?.error ?? ui.loadError);
    }
    const data = (await res.json()) as { items: TxRow[]; total: number };
    setItems(data.items);
    setTotal(data.total);
  }, [activeTab, page, pageSize, ui.loadError]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await loadSummary();
        if (cancelled) return;
        setSummary(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary, ui.loadError]);

  useEffect(() => {
    if (!summary) return;
    void loadTransactions().catch((e) => setError(e instanceof Error ? e.message : ui.loadError));
  }, [summary, loadTransactions]);

  const submitWithdrawal = async () => {
    const amount = Number.parseFloat(withdrawAmount.replace(",", "."));
    const minAmount = Number.parseFloat(summary?.minWithdrawalAmount ?? "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(ui.withdrawError);
      return;
    }
    if (Number.isFinite(minAmount) && amount < minAmount) {
      const msg = ui.withdrawBelowMin.replace(
        "{amount}",
        formatMoney(summary!.minWithdrawalAmount, summary!.currency, locale),
      );
      toast.error(msg);
      return;
    }
    if (summary?.withdrawIdExpired) {
      toast.error(ui.kycExpiredBanner);
      return;
    }
    if (!summary?.withdrawKycApproved) {
      toast.error(ui.kycRequiredBanner);
      return;
    }
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/customer/wallet/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      if (!res.ok) {
        const code = payload?.code;
        if (code === "BELOW_MINIMUM") {
          throw new Error(
            ui.withdrawBelowMin.replace(
              "{amount}",
              formatMoney(summary!.minWithdrawalAmount, summary!.currency, locale),
            ),
          );
        }
        if (code === "KYC_ID_EXPIRED") throw new Error(ui.kycExpiredBanner);
        if (code === "KYC_NOT_APPROVED") throw new Error(ui.kycRequiredBanner);
        throw new Error(payload?.error ?? ui.withdrawError);
      }
      setWithdrawAmount("");
      toast.success(ui.withdrawSuccess);
      const s = await loadSummary();
      setSummary(s);
      setPage(1);
      await loadTransactions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.withdrawError;
      setError(msg);
      toast.error(msg);
    } finally {
      setWithdrawing(false);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const formatAmount = (row: TxRow) => {
    const sign = row.direction === "CREDIT" ? "+" : "−";
    return `${sign}${formatMoney(row.amount, summary?.currency ?? "SAR", locale)}`;
  };

  const tabButtons: { id: HistoryTab; label: string }[] = [
    { id: "all", label: ui.tabAll },
    { id: "CASHBACK", label: ui.tabCashback },
    { id: "AFFILIATE_COMMISSION", label: ui.tabAffiliate },
  ];

  if (loading && !summary) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error && !summary) {
    return <p className="app-alert-error mt-8">{error}</p>;
  }

  if (!summary) {
    return <p className="app-alert-error mt-8">{ui.loadError}</p>;
  }

  return (
    <div dir={direction}>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.available}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(summary.availableBalance, summary.currency, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.pending}</p>
          <p className="mt-2 text-lg font-medium tabular-nums text-[var(--foreground)]">
            {formatMoney(summary.pendingBalance, summary.currency, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.locked}</p>
          <p className="mt-2 text-lg font-medium tabular-nums text-[var(--foreground)]">
            {formatMoney(summary.lockedBalance, summary.currency, locale)}
          </p>
        </div>
      </section>

      {summary.otherMarkets.length > 0 ? (
        <section className="app-callout-primary mt-6 p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.otherMarketsTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{ui.otherMarketsHint}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.otherMarkets.map((row) => (
              <li key={row.marketId} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[var(--foreground)]">{row.marketName}</span>
                <span className="tabular-nums text-[var(--muted)]">
                  {formatMoney(row.availableBalance, row.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.withdrawIdExpired ? (
        <p className="app-alert-error mt-6 text-sm">{ui.kycExpiredBanner}</p>
      ) : !summary.withdrawKycApproved ? (
        <p className="app-alert-error mt-6 text-sm">{ui.kycRequiredBanner}</p>
      ) : null}

      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold">{ui.withdrawTitle}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{ui.withdrawHint}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {ui.withdrawMinHint.replace(
            "{amount}",
            formatMoney(summary.minWithdrawalAmount, summary.currency, locale),
          )}
        </p>
        <p className="mt-2 text-sm">
          <a href="/kyc" className="text-link font-medium">
            {ui.kycLink}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">{ui.withdrawAmount}</span>
            <input
              type="number"
              min={summary.minWithdrawalAmount}
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_40%,transparent)]"
            />
          </label>
          <button
            type="button"
            disabled={
              withdrawing ||
              Number.parseFloat(summary.availableBalance) < Number.parseFloat(summary.minWithdrawalAmount) ||
              !summary.withdrawKycApproved ||
              summary.withdrawIdExpired
            }
            onClick={() => void submitWithdrawal()}
            className="btn-primary btn-press rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {withdrawing ? ui.withdrawSubmitting : ui.withdrawSubmit}
          </button>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <div className="app-callout-success p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.rulesTitle}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ui.rulesBody.replace("{rate}", String(summary.cashbackRatePercent))}
          </p>
        </div>
        <div className="app-callout-primary p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.rulesAffiliateTitle}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.rulesAffiliateBody}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{ui.historyTitle}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--table-head-bg)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {error ? <p className="app-alert-error mt-4">{error}</p> : null}
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{ui.emptyHistory}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-start text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)] dark:bg-[var(--surface)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{ui.colDate}</th>
                  <th className="px-4 py-3 font-medium">{ui.colType}</th>
                  <th className="px-4 py-3 font-medium">{ui.colAmount}</th>
                  <th className="px-4 py-3 font-medium">{ui.colStatus}</th>
                  <th className="px-4 py-3 font-medium">{ui.colReference}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--table-row-border)]">
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      {ui.entryTypeLabels[row.entryType] ?? row.entryType}
                      {row.displaySource ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.displaySource}</span>
                      ) : null}
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {row.direction === "CREDIT" ? ui.directionCredit : ui.directionDebit}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatAmount(row)}</td>
                    <td className="px-4 py-3">{statusLabel(row.status, ui.statusLabels)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {row.entryType === "WITHDRAWAL" && row.meta?.paidAt ? (
                        <span className="block text-[var(--foreground)]">{ui.withdrawPaidHint}</span>
                      ) : null}
                      {row.referenceType}:{row.referenceId.slice(0, 8)}…
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
            className="mt-4"
          />
        ) : null}
      </section>
    </div>
  );
}
