"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/format-currency";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";
type OrdersText = {
  statusFilter: string;
  dateFilter: string;
  allStatuses: string;
  new: string;
  processing: string;
  shipped: string;
  completed: string;
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
  orderNumber: string;
  total: string;
  orderedOn: string;
  currency: string;
  viewDetails: string;
  actionsLabel: string;
  invoice: string;
  requestReturn: string;
};

type CustomerOrderListItem = {
  id: string;
  orderNo: string;
  status: string;
  customerStep: string;
  totalAmount: string;
  createdAt: string;
};

type OrdersResponse = {
  items: CustomerOrderListItem[];
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

function customerStepLabel(stepLabels: Record<string, string>, step: string): string {
  return stepLabels[step] ?? step;
}

function formatOrderedAt(iso: string, locale: Locale): string {
  const value = new Date(iso);
  return value.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function OrderActionsMenu({
  orderId,
  isRtl,
  ui,
}: {
  orderId: string;
  isRtl: boolean;
  ui: OrdersText;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "block w-full px-4 py-2.5 text-start text-sm text-[var(--foreground)] transition hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ui.actionsLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="btn-press flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className={`animate-dropdown-down absolute top-full z-20 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[var(--shadow-md)] ${
            isRtl ? "start-0" : "end-0"
          }`}
        >
          <Link href={`/orders/${orderId}`} role="menuitem" className={itemClass}>
            {ui.viewDetails}
          </Link>
          <Link href={`/orders/${orderId}/invoice`} role="menuitem" className={itemClass}>
            {ui.invoice}
          </Link>
          <Link
            href={`/returns/new?orderId=${orderId}`}
            role="menuitem"
            className={itemClass}
          >
            {ui.requestReturn}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function OrdersView({
  locale,
  ui,
  stepLabels,
}: {
  locale: Locale;
  ui: OrdersText;
  stepLabels: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [data, setData] = useState<OrdersResponse | null>(null);
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

        const response = await fetch(`/api/v1/customer/orders?${query.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? ui.loadError);
        }

        const payload = (await response.json()) as OrdersResponse;
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
    const basePath = pathname && pathname.length > 0 ? pathname : "/orders";
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
              <option value="new">{ui.new}</option>
              <option value="processing">{ui.processing}</option>
              <option value="shipped">{ui.shipped}</option>
              <option value="completed">{ui.completed}</option>
              <option value="cancelled">{ui.cancelled}</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">{ui.dateFilter}</span>
            <select
              className="app-input"
              value={dateRange}
              onChange={(event) => {
                const v = event.target.value;
                if (v === "custom") {
                  updateFilter({ dateRange: "custom" });
                } else {
                  updateFilter({ dateRange: v });
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

      {isLoading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : null}

      {error ? (
        <p className="mt-6 app-alert-error">
          {error}
        </p>
      ) : null}

      {!isLoading && !error && !isEmpty && data ? (
        <ul className="mt-6 space-y-3" dir={direction}>
          {data.items.map((item) => (
            <li key={item.id}>
              <div className="app-card p-4 transition hover:border-[var(--primary)] hover:shadow-[var(--shadow-md)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${item.id}`}
                      className="text-sm font-semibold text-[var(--foreground)] underline-offset-2 hover:text-[var(--primary)] hover:underline"
                    >
                      {ui.orderNumber} · {item.orderNo}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {ui.orderedOn}: {formatOrderedAt(item.createdAt, locale)}
                    </p>
                    <Link
                      href={`/orders/${item.id}`}
                      className="mt-3 inline-block text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                    >
                      {ui.viewDetails}
                    </Link>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-end">
                      <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        {customerStepLabel(stepLabels, item.customerStep)}
                      </span>
                      <p className="mt-2 text-base font-semibold tabular-nums">
                        {formatMoney(item.totalAmount, "SAR", locale)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{ui.total}</p>
                    </div>
                    <OrderActionsMenu orderId={item.id} isRtl={locale === "ar"} ui={ui} />
                  </div>
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
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.emptyTitle}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.emptySubtitle}</p>
        </section>
      ) : null}
    </>
  );
}
