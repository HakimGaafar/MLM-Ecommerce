"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/toast/ToastProvider";
import { getPaginationLabels } from "@/lib/pagination-labels";

type Locale = "en" | "ar";

type MarketOption = {
  code: string;
  label: string;
};

type AuditRow = {
  id: string;
  marketId: string;
  marketCode: string;
  marketNameEn: string;
  marketNameAr: string;
  actorUserId: string;
  actorName: string | null;
  summary: string;
  changesJson: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
};

type Ui = {
  loading: string;
  loadError: string;
  empty: string;
  marketFilter: string;
  allMarkets: string;
  marketColumn: string;
  summaryColumn: string;
  actorColumn: string;
  whenColumn: string;
  details: string;
  fieldColumn: string;
  fromColumn: string;
  toColumn: string;
  backToSettings: string;
  fieldLabels: Record<string, string>;
};

const PAGE_SIZE = 20;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AdminPlatformConfigAuditList({
  locale,
  ui,
  markets,
  initialMarketCode,
}: {
  locale: Locale;
  ui: Ui;
  markets: MarketOption[];
  initialMarketCode: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const toast = useToast();
  const [marketFilter, setMarketFilter] = useState(initialMarketCode);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (marketFilter !== "ALL") params.set("marketCode", marketFilter);
      const res = await fetch(`/api/v1/admin/settings/change-log?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(ui.loadError);
      const data = (await res.json()) as { items: AuditRow[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error(ui.loadError);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [marketFilter, page, toast, ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [marketFilter]);

  const showMarketColumn = marketFilter === "ALL";

  return (
    <div className="mt-8 space-y-4" dir={direction}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex min-w-[14rem] flex-col gap-2 text-sm">
          <span className="text-[var(--muted)]">{ui.marketFilter}</span>
          <select
            className="app-input"
            value={marketFilter}
            disabled={loading}
            onChange={(e) => setMarketFilter(e.target.value)}
          >
            <option value="ALL">{ui.allMarkets}</option>
            {markets.map((market) => (
              <option key={market.code} value={market.code}>
                {market.label}
              </option>
            ))}
          </select>
        </label>
        <Link href="/admin/settings" className="text-sm font-medium text-link">
          {ui.backToSettings}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-left">
              <tr>
                {showMarketColumn ? (
                  <th className="px-4 py-3 font-medium">{ui.marketColumn}</th>
                ) : null}
                <th className="px-4 py-3 font-medium">{ui.whenColumn}</th>
                <th className="px-4 py-3 font-medium">{ui.actorColumn}</th>
                <th className="px-4 py-3 font-medium">{ui.summaryColumn}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const marketLabel = locale === "ar" ? row.marketNameAr : row.marketNameEn;
                const expanded = expandedId === row.id;
                const changeEntries = Object.entries(row.changesJson);
                const colSpan = showMarketColumn ? 5 : 4;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-[var(--border)] align-top">
                      {showMarketColumn ? (
                        <td className="px-4 py-3">
                          <div className="font-medium">{marketLabel}</div>
                          <div className="text-xs text-[var(--muted)]">{row.marketCode}</div>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                        {new Date(row.createdAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB")}
                      </td>
                      <td className="px-4 py-3">{row.actorName ?? "—"}</td>
                      <td className="px-4 py-3">{row.summary}</td>
                      <td className="px-4 py-3 text-right">
                        {changeEntries.length > 0 ? (
                          <button
                            type="button"
                            className="text-link text-xs"
                            onClick={() => setExpandedId(expanded ? null : row.id)}
                          >
                            {ui.details}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-[var(--border)] bg-[var(--surface-elevated)]/40">
                        <td colSpan={colSpan} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="py-1 text-left font-medium">{ui.fieldColumn}</th>
                                <th className="py-1 text-left font-medium">{ui.fromColumn}</th>
                                <th className="py-1 text-left font-medium">{ui.toColumn}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changeEntries.map(([field, change]) => (
                                <tr key={field} className="border-t border-[var(--border)]/60">
                                  <td className="py-2 pr-4 font-mono">
                                    {ui.fieldLabels[field] ?? field}
                                  </td>
                                  <td className="py-2 pr-4 text-[var(--muted)]">
                                    {formatValue(change.from)}
                                  </td>
                                  <td className="py-2">{formatValue(change.to)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          labels={getPaginationLabels(locale)}
        />
      ) : null}
    </div>
  );
}
