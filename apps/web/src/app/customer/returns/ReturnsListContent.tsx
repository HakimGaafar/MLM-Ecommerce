"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CustomerReturnListItemDto } from "@mlm/domain";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type ReturnsUi = {
  statusFilter: string;
  dateFilter: string;
  allStatuses: string;
  active: string;
  completed: string;
  rejected: string;
  cancelled: string;
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
  loading: string;
  loadError: string;
  emptyTitle: string;
  emptySubtitle: string;
  emptyFiltered: string;
  orderNo: string;
  status: string;
  reason: string;
  submittedOn: string;
  view: string;
  unitCount: string;
};

type ReturnsResponse = {
  items: CustomerReturnListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: {
    status: string;
    dateRange: string;
    dateFrom: string;
    dateTo: string;
  };
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: string): string {
  if (status === "REFUND_COMPLETED") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "PROCESSING_REJECTED" || status === "CANCELLED_BY_CUSTOMER") {
    return "bg-red-500/15 text-red-700 dark:text-red-300";
  }
  return "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--foreground)]";
}

export default function ReturnsListContent({
  locale,
  ui,
  reasonLabels,
  statusLabels,
}: {
  locale: Locale;
  ui: ReturnsUi;
  reasonLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [data, setData] = useState<ReturnsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const direction = locale === "ar" ? "rtl" : "ltr";
  const status = searchParams.get("status") ?? "all";
  const dateRange = searchParams.get("dateRange") ?? "all";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = LIST_PAGE_SIZE;
  const hasActiveFilters = status !== "all" || dateRange !== "all";

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
          status,
          dateRange,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);

        const response = await fetch(`/api/v1/customer/returns?${query.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? ui.loadError);
        }

        const payload = (await response.json()) as ReturnsResponse;
        if (!cancelled) {
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
  }, [status, dateRange, dateFrom, dateTo, page, pageSize, ui.loadError, toast, toastDict]);

  function updateFilter(next: {
    status?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    clearCustom?: boolean;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
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
      next.status !== undefined ||
      next.dateRange !== undefined ||
      next.clearCustom ||
      next.dateFrom !== undefined ||
      next.dateTo !== undefined
    ) {
      params.delete("page");
    }
    const basePath = pathname && pathname.length > 0 ? pathname : "/returns";
    router.replace(`${basePath}?${params.toString()}`);
  }

  const isEmpty = useMemo(() => !data?.items?.length, [data?.items]);
  const showCustom = dateRange === "custom";

  return (
    <>
      <section className="app-card mt-6 grid gap-3 p-4" dir={direction}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.statusFilter}</span>
            <select
              className="app-input"
              value={status}
              onChange={(event) => updateFilter({ status: event.target.value })}
            >
              <option value="all">{ui.allStatuses}</option>
              <option value="active">{ui.active}</option>
              <option value="completed">{ui.completed}</option>
              <option value="rejected">{ui.rejected}</option>
              <option value="cancelled">{ui.cancelled}</option>
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
          {data.items.map((row) => (
            <li key={row.id}>
              <div className="app-card p-4 transition hover:border-[var(--primary)] hover:shadow-[var(--shadow-md)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/returns/${row.id}`}
                      className="font-mono text-sm font-semibold text-[var(--foreground)] underline-offset-2 hover:text-[var(--primary)] hover:underline"
                    >
                      {ui.orderNo} · {row.orderNo}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {ui.submittedOn}: {formatDate(row.createdAt, locale)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {ui.reason}: {reasonLabels[row.reason] ?? row.reason}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {ui.unitCount.replace("{count}", String(row.unitCount))}
                    </p>
                    <Link
                      href={`/returns/${row.id}`}
                      className="mt-3 inline-block text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                    >
                      {ui.view}
                    </Link>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                  >
                    {statusLabels[row.status] ?? row.status}
                  </span>
                </div>
              </div>
            </li>
          ))}
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
