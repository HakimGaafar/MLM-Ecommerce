"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format-currency";

type Locale = "en" | "ar";

type Analytics = {
  generatedAt: string;
  currency: string;
  summary: { totalOrders: number; totalGmv: string; averageOrderValue: string };
  ordersByStatus: { status: string; count: number }[];
  ordersOverTime: { date: string; orderCount: number; gmv: string }[];
  vendorsByGmv: { vendorId: string; storeName: string; orderCount: number; gmv: string }[];
  regions: { countryCode: string; orderCount: number; gmv: string }[];
  topProducts: { productId: string | null; name: string; unitsSold: number; gmv: string }[];
};

type Ui = {
  loading: string;
  loadError: string;
  asOf: string;
  totalOrders: string;
  totalGmv: string;
  aov: string;
  ordersByStatus: string;
  ordersOverTime: string;
  vendorsByGmv: string;
  regions: string;
  topProducts: string;
  emptyChart: string;
  orderStatusLabels: Record<string, string>;
};

function BarChart({ items }: { items: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs text-[var(--muted)]">
            <span className="truncate font-medium text-[var(--foreground)]">{item.label}</span>
            <span className="shrink-0 tabular-nums">{item.display ?? String(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--table-head-bg)]">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminAnalyticsView({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/analytics", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.loadError);
      }
      const json = (await res.json()) as { analytics: Analytics };
      setData(json.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.loadError);
    } finally {
      setLoading(false);
    }
  }, [ui.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="mt-8 text-sm text-[var(--muted)]">{ui.loading}</p>;
  }

  if (error || !data) {
    return <p className="mt-8 text-sm text-red-600 dark:text-red-400">{error ?? ui.loadError}</p>;
  }

  const asOf = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(data.generatedAt));

  const statusBars = data.ordersByStatus.map((s) => ({
    label: ui.orderStatusLabels[s.status] ?? s.status,
    value: s.count,
    display: String(s.count),
  }));

  const timeBars = data.ordersOverTime.map((d) => ({
    label: d.date,
    value: d.orderCount,
    display: `${d.orderCount} · ${formatMoney(d.gmv, data.currency, locale)}`,
  }));

  const vendorBars = data.vendorsByGmv.map((v) => ({
    label: v.storeName,
    value: Number(v.gmv),
    display: formatMoney(v.gmv, data.currency, locale),
  }));

  const regionBars = data.regions.map((r) => ({
    label: r.countryCode,
    value: Number(r.gmv),
    display: `${formatMoney(r.gmv, data.currency, locale)} (${r.orderCount})`,
  }));

  const productBars = data.topProducts.map((p) => ({
    label: p.name,
    value: Number(p.gmv),
    display: formatMoney(p.gmv, data.currency, locale),
  }));

  return (
    <div className="mt-8 space-y-8" dir={direction}>
      <p className="text-xs text-[var(--muted)]">{ui.asOf.replace("{time}", asOf)}</p>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.totalOrders}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.summary.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.totalGmv}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(data.summary.totalGmv, data.currency, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.aov}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(data.summary.averageOrderValue, data.currency, locale)}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={ui.ordersByStatus} bars={statusBars} empty={ui.emptyChart} />
        <ChartCard title={ui.ordersOverTime} bars={timeBars} empty={ui.emptyChart} />
        <ChartCard title={ui.vendorsByGmv} bars={vendorBars} empty={ui.emptyChart} />
        <ChartCard title={ui.regions} bars={regionBars} empty={ui.emptyChart} />
        <div className="lg:col-span-2">
          <ChartCard title={ui.topProducts} bars={productBars} empty={ui.emptyChart} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  bars,
  empty,
}: {
  title: string;
  bars: { label: string; value: number; display?: string }[];
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {bars.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">{empty}</p> : <BarChart items={bars} />}
    </section>
  );
}
