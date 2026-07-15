"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";
import { statusLabel } from "@/lib/status-label";

type Locale = "en" | "ar";

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

type WalletSummary = {
  currency: string;
  availableBalance: string;
  pendingBalance: string;
  lockedBalance: string;
};

type OperationsUi = {
  loading: string;
  loadError: string;
  emptyTitle: string;
  emptySubtitle: string;
  emptyFiltered: string;
  directionFilter: string;
  statusFilter: string;
  dateFilter: string;
  allDirections: string;
  credits: string;
  debits: string;
  allStatuses: string;
  pending: string;
  approved: string;
  reversed: string;
  allDates: string;
  last7Days: string;
  last30Days: string;
  last90Days: string;
  last365Days: string;
  customRange: string;
  dateFrom: string;
  dateTo: string;
  applyCustomRange: string;
  clearCustomRange: string;
  available: string;
  pendingBalance: string;
  locked: string;
  entryTypeLabels: Record<string, string>;
  kindLabels: Record<string, string>;
  reversedHint: string;
  orderRef: string;
  statusLabels: Record<string, string>;
  backToPayout: string;
};

type OperationsResponse = {
  items: TxRow[];
  total: number;
  filters: {
    direction: string;
    status: string;
    dateRange: string;
    dateFrom: string;
    dateTo: string;
  };
};

function formatOrderRef(template: string, orderNo: string) {
  return template.replace("{orderNo}", orderNo);
}

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ledgerStatusClass(status: string): string {
  if (status === "APPROVED") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "REVERSED" || status === "DECLINED") {
    return "bg-red-500/15 text-red-700 dark:text-red-300";
  }
  return "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--foreground)]";
}

export default function VendorOperationsView({ locale, ui }: { locale: Locale; ui: OperationsUi }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const direction = locale === "ar" ? "rtl" : "ltr";
  const dirFilter = searchParams.get("direction") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const dateRange = searchParams.get("dateRange") ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = LIST_PAGE_SIZE;
  const hasActiveFilters = dirFilter !== "all" || status !== "all" || dateRange !== "all";
  const currency = summary?.currency ?? "SAR";

  useEffect(() => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setIsLoading(true);

        const query = new URLSearchParams({
          direction: dirFilter,
          status,
          dateRange,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);

        const [walletRes, opsRes] = await Promise.all([
          fetch("/api/v1/vendor/wallet", { credentials: "include", cache: "no-store" }),
          fetch(`/api/v1/vendor/wallet/operations?${query.toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        if (!walletRes.ok || !opsRes.ok) {
          const payload = (await opsRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? ui.loadError);
        }

        const wallet = (await walletRes.json()) as WalletSummary;
        const payload = (await opsRes.json()) as OperationsResponse;
        if (!cancelled) {
          setSummary(wallet);
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          const msg = loadError instanceof Error ? loadError.message : ui.loadError;
          setError(msg);
          toast.error(msg || toastDict.genericError);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dirFilter, status, dateRange, dateFrom, dateTo, page, pageSize, ui.loadError, toast, toastDict]);

  function updateFilter(next: {
    direction?: string;
    status?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    clearCustom?: boolean;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.direction !== undefined) params.set("direction", next.direction);
    if (next.status !== undefined) params.set("status", next.status);
    if (next.dateRange !== undefined) {
      params.set("dateRange", next.dateRange);
      if (next.dateRange !== "custom") {
        params.delete("dateFrom");
        params.delete("dateTo");
      }
    }
    if (next.clearCustom) {
      params.delete("dateFrom");
      params.delete("dateTo");
      params.set("dateRange", "all");
    }
    if (next.dateFrom !== undefined) {
      if (next.dateFrom) params.set("dateFrom", next.dateFrom);
      else params.delete("dateFrom");
    }
    if (next.dateTo !== undefined) {
      if (next.dateTo) params.set("dateTo", next.dateTo);
      else params.delete("dateTo");
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    } else if (
      next.direction !== undefined ||
      next.status !== undefined ||
      next.dateRange !== undefined ||
      next.clearCustom ||
      next.dateFrom !== undefined ||
      next.dateTo !== undefined
    ) {
      params.delete("page");
    }
    const basePath = pathname && pathname.length > 0 ? pathname : "/vendor/operations";
    router.replace(`${basePath}?${params.toString()}`);
  }

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

  const isEmpty = useMemo(() => !data?.items?.length, [data?.items]);
  const showCustom = dateRange === "custom";

  return (
    <>
      <Link href="/vendor/payout" className="text-link text-sm font-medium">
        {ui.backToPayout}
      </Link>

      {summary ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3" dir={direction}>
          <div className="app-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {ui.available}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.availableBalance, summary.currency, locale)}
            </p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {ui.pendingBalance}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.pendingBalance, summary.currency, locale)}
            </p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {ui.locked}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(summary.lockedBalance, summary.currency, locale)}
            </p>
          </div>
        </div>
      ) : null}

      <section className="app-card mt-6 grid gap-3 p-4" dir={direction}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.directionFilter}</span>
            <select
              className="app-input"
              value={dirFilter}
              onChange={(event) => updateFilter({ direction: event.target.value })}
            >
              <option value="all">{ui.allDirections}</option>
              <option value="credit">{ui.credits}</option>
              <option value="debit">{ui.debits}</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.statusFilter}</span>
            <select
              className="app-input"
              value={status}
              onChange={(event) => updateFilter({ status: event.target.value })}
            >
              <option value="all">{ui.allStatuses}</option>
              <option value="pending">{ui.pending}</option>
              <option value="approved">{ui.approved}</option>
              <option value="reversed">{ui.reversed}</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.dateFilter}</span>
            <select
              className="app-input"
              value={dateRange}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "custom") {
                  updateFilter({ dateRange: "custom" });
                } else {
                  updateFilter({ dateRange: value });
                }
              }}
            >
              <option value="all">{ui.allDates}</option>
              <option value="7">{ui.last7Days}</option>
              <option value="30">{ui.last30Days}</option>
              <option value="90">{ui.last90Days}</option>
              <option value="365">{ui.last365Days}</option>
              <option value="custom">{ui.customRange}</option>
            </select>
          </label>
        </div>

        {showCustom ? (
          <div className="grid gap-3 border-t border-[var(--border)] pt-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{ui.dateFrom}</span>
              <input
                type="date"
                className="app-input"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{ui.dateTo}</span>
              <input
                type="date"
                className="app-input"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="button"
                className="btn-primary btn-press"
                onClick={() => {
                  updateFilter({
                    dateRange: "custom",
                    dateFrom: draftFrom,
                    dateTo: draftTo,
                  });
                }}
              >
                {ui.applyCustomRange}
              </button>
              <button
                type="button"
                className="btn-secondary btn-press"
                onClick={() => updateFilter({ clearCustom: true })}
              >
                {ui.clearCustomRange}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {isLoading ? <p className="mt-6 text-sm text-[var(--muted)]">{ui.loading}</p> : null}

      {error ? <p className="mt-6 app-alert-error">{error}</p> : null}

      {!isLoading && !error && !isEmpty && data ? (
        <ul className="mt-6 space-y-3" dir={direction}>
          {data.items.map((row) => {
            const isReversed = row.status === "REVERSED";
            const isReturnReversal =
              row.meta?.kind === "vendor_earning_reversal" || row.referenceType === "order_return";
            const subLabel = rowSubLabel(row);

            return (
              <li key={row.id}>
                <div
                  className={`app-card p-4 ${isReversed ? "opacity-75" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          isReversed ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"
                        }`}
                      >
                        {rowTypeLabel(row)}
                      </p>
                      {subLabel ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">{subLabel}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {formatDate(row.createdAt, locale)}
                      </p>
                    </div>
                    <div className="text-end">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ledgerStatusClass(row.status)}`}
                      >
                        {statusLabel(row.status, ui.statusLabels)}
                      </span>
                      <p
                        className={[
                          "mt-2 text-base font-semibold tabular-nums",
                          isReversed ? "text-[var(--muted)] line-through" : "",
                          isReturnReversal && !isReversed ? "text-amber-700 dark:text-amber-400" : "",
                          row.direction === "CREDIT" && !isReversed
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "",
                          row.direction === "DEBIT" && !isReversed
                            ? "text-red-700 dark:text-red-400"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {row.direction === "CREDIT" ? "+" : "−"}
                        {formatMoney(row.amount, currency, locale)}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!isLoading && !error && data && data.items.length > 0 ? (
        <Pagination
          page={page}
          total={data.total}
          pageSize={pageSize}
          onPageChange={(nextPage) => updateFilter({ page: nextPage })}
          labels={getPaginationLabels(locale)}
          className="mt-6"
        />
      ) : null}

      {!isLoading && !error && isEmpty ? (
        <section className="app-card mt-6 border-dashed p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {hasActiveFilters ? ui.emptyFiltered : ui.emptyTitle}
          </h2>
          {!hasActiveFilters ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{ui.emptySubtitle}</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
