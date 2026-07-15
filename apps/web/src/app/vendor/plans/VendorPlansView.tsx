"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format-currency";
import { LIST_PAGE_SIZE } from "@/lib/list-page";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type BillRow = {
  id: string;
  type: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

type PlansData = {
  planCode: string;
  planLabel: string;
  bills: BillRow[];
  billsTotal: number;
};

type Ui = {
  loading: string;
  loadError: string;
  currentPlan: string;
  planStubNote: string;
  billsTitle: string;
  emptyBills: string;
  colDescription: string;
  colAmount: string;
  colStatus: string;
  colDate: string;
  statusPending: string;
  statusPaid: string;
  statusWaived: string;
  typePlan: string;
  typePlatform: string;
};

function statusLabel(status: string, ui: Ui): string {
  switch (status) {
    case "PAID":
      return ui.statusPaid;
    case "WAIVED":
      return ui.statusWaived;
    default:
      return ui.statusPending;
  }
}

export default function VendorPlansView({ locale, ui }: { locale: Locale; ui: Ui }) {
  const [page, setPage] = useState(1);
  const pageSize = LIST_PAGE_SIZE;
  const [data, setData] = useState<PlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/vendor/plans?page=${page}&pageSize=${pageSize}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      setData((await res.json()) as PlansData);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <p className="text-sm text-[var(--muted)]">{ui.loading}</p>;
  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section className="app-card p-4 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">{ui.currentPlan}</p>
        <p className="mt-2 text-xl font-semibold">{data.planLabel}</p>
        <p className="mt-1 font-mono text-sm text-[var(--muted)]">{data.planCode}</p>
        <p className="mt-4 text-sm text-[var(--muted)]">{ui.planStubNote}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{ui.billsTitle}</h2>
        {data.bills.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{ui.emptyBills}</p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[32rem] text-start text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--table-head-bg)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">{ui.colDescription}</th>
                    <th className="px-4 py-2 font-medium">{ui.colAmount}</th>
                    <th className="px-4 py-2 font-medium">{ui.colStatus}</th>
                    <th className="px-4 py-2 font-medium">{ui.colDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.map((bill) => (
                    <tr key={bill.id} className="border-b border-[var(--table-row-border)]">
                      <td className="px-4 py-2">
                        <p>{bill.description}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {bill.type === "PLAN_FEE" ? ui.typePlan : ui.typePlatform}
                        </p>
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatMoney(bill.amount, bill.currency, locale)}
                      </td>
                      <td className="px-4 py-2">{statusLabel(bill.status, ui)}</td>
                      <td className="px-4 py-2 text-[var(--muted)]">
                        {new Date(bill.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={data.billsTotal}
              pageSize={pageSize}
              onPageChange={setPage}
              labels={getPaginationLabels(locale)}
              className="mt-4"
            />
          </>
        )}
      </section>
    </div>
  );
}
