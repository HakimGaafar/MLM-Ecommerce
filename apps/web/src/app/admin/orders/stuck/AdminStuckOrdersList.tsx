"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { formatWaitHours } from "@/lib/format-wait-duration";
import { fulfillmentTypeLabel } from "@/lib/fulfillment-labels";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";

type Locale = "en" | "ar";

type Row = {
  orderId: string;
  orderNo: string;
  orderStatus: string;
  createdAt: string;
  buyerName: string;
  totalAmount: string;
  stuckGroupCount: number;
  worstHoursWaiting: number;
  primaryBlocker: {
    vendorName: string;
    fulfillmentType: string;
    fulfillmentStatus: string;
    hoursWaiting: number;
  } | null;
};

type Ui = {
  title: string;
  loading: string;
  loadError: string;
  empty: string;
  orderNo: string;
  status: string;
  buyer: string;
  blocker: string;
  waiting: string;
  groups: string;
  view: string;
  slaBypassHint: string;
  slaDemoHint: string;
  back: string;
  statusLabels: Record<string, string>;
  fulfillmentDict: {
    fulfillmentDirect: string;
    fulfillmentWarehouseA: string;
    fulfillmentWarehouseB: string;
  };
};

export default function AdminStuckOrdersList({
  locale,
  ui,
}: {
  locale: Locale;
  ui: Ui;
}) {
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slaBypass, setSlaBypass] = useState(false);
  const [slaDemo, setSlaDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/stuck?page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as {
        items: Row[];
        total: number;
        slaConfig?: { bypass?: boolean; demoStuck?: boolean };
      };
      setItems(data.items);
      setTotal(data.total);
      setSlaBypass(Boolean(data.slaConfig?.bypass));
      setSlaDemo(Boolean(data.slaConfig?.demoStuck));
    } catch (e) {
      const msg = e instanceof Error ? e.message : ui.loadError;
      setError(msg);
      toast.error(msg || toastDict.genericError);
    } finally {
      setLoading(false);
    }
  }, [page, ui.loadError, toast, toastDict.genericError]);

  useEffect(() => {
    void load();
  }, [load]);

  const pagination = getPaginationLabels(locale);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{ui.title}</h1>
        <Link href="/admin/orders" className="text-sm text-link font-medium">
          {ui.back}
        </Link>
      </div>
      {slaBypass ? <p className="app-callout-info px-3 py-2 text-sm">{ui.slaBypassHint}</p> : null}
      {slaDemo ? <p className="app-callout-warning px-3 py-2 text-sm">{ui.slaDemoHint}</p> : null}
      {loading ? <p>{ui.loading}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : null}
      {!loading && items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[40rem] text-start text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                <tr>
                  <th className="px-4 py-2 font-medium">{ui.orderNo}</th>
                  <th className="px-4 py-2 font-medium">{ui.status}</th>
                  <th className="px-4 py-2 font-medium">{ui.buyer}</th>
                  <th className="px-4 py-2 font-medium">{ui.blocker}</th>
                  <th className="px-4 py-2 font-medium">{ui.waiting}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.orderId} className="border-b border-[var(--table-row-border)]">
                    <td className="px-4 py-2 font-medium">{row.orderNo}</td>
                    <td className="px-4 py-2">{ui.statusLabels[row.orderStatus] ?? row.orderStatus}</td>
                    <td className="px-4 py-2">{row.buyerName}</td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">
                      {row.primaryBlocker
                        ? `${row.primaryBlocker.vendorName} · ${fulfillmentTypeLabel(row.primaryBlocker.fulfillmentType, ui.fulfillmentDict)} · ${ui.statusLabels[row.primaryBlocker.fulfillmentStatus] ?? row.primaryBlocker.fulfillmentStatus}`
                        : "—"}
                      <br />
                      {ui.groups}: {row.stuckGroupCount}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{formatWaitHours(row.worstHoursWaiting, locale)}</td>
                    <td className="px-4 py-2">
                      <Link href={`/admin/orders/${row.orderId}`} className="text-link text-sm font-medium">
                        {ui.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={LIST_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            labels={pagination}
          />
        </>
      ) : null}
    </div>
  );
}
