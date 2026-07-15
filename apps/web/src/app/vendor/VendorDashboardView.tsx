"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import { formatMoney } from "@/lib/format-currency";

type Locale = "en" | "ar";

type Setup = {
  completedCount: number;
  totalSteps: number;
  steps: { id: string; complete: boolean }[];
};

type Analytics = {
  generatedAt: string;
  currency: string;
  today: { orderCount: number; gmv: string; itemsSold: number };
  monthCompare: {
    thisMonth: { orderCount: number; gmv: string };
    lastMonth: { orderCount: number; gmv: string };
  };
  ordersByStatus: { status: string; count: number }[];
  ordersOverTime: { date: string; orderCount: number; gmv: string }[];
};

type Snapshot = {
  productsTotal: number;
  productsByStatus: { status: string; count: number }[];
  activeCoupons: number;
};

type Ui = {
  loading: string;
  loadError: string;
  sectionOverview: string;
  sectionShortcuts: string;
  catalogTitle: string;
  productsTotal: string;
  activeCoupons: string;
  productStatusLabels: Record<string, string>;
  setupTitle: string;
  setupProgress: string;
  setupCta: string;
  todayOrders: string;
  todayGmv: string;
  todayItems: string;
  monthThis: string;
  monthLast: string;
  ordersByStatus: string;
  ordersOverTime: string;
  emptyChart: string;
  linkProducts: string;
  linkOrders: string;
  linkCoupons: string;
  linkPayout: string;
  linkStore: string;
  linkSetup: string;
  orderStatusLabels: Record<string, string>;
};

export default function VendorDashboardView({ locale, ui }: { locale: Locale; ui: Ui }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [setupRes, analyticsRes] = await Promise.all([
        fetch("/api/v1/vendor/setup", { credentials: "include", cache: "no-store" }),
        fetch("/api/v1/vendor/analytics", { credentials: "include", cache: "no-store" }),
      ]);
      if (!setupRes.ok || !analyticsRes.ok) throw new Error(ui.loadError);
      const setupJson = (await setupRes.json()) as { setup: Setup };
      const analyticsJson = (await analyticsRes.json()) as { analytics: Analytics; snapshot?: Snapshot };
      setSetup(setupJson.setup);
      setAnalytics(analyticsJson.analytics);
      setSnapshot(
        analyticsJson.snapshot ?? {
          productsTotal: 0,
          productsByStatus: [],
          activeCoupons: 0,
        },
      );
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

  if (error || !setup || !analytics || !snapshot) {
    return <p className="mt-8 text-sm text-red-600 dark:text-red-400">{error ?? ui.loadError}</p>;
  }

  const setupIncomplete = setup.completedCount < setup.totalSteps;
  const statusBars = analytics.ordersByStatus.map((s) => ({
    label: ui.orderStatusLabels[s.status] ?? s.status,
    value: s.count,
  }));
  const trendBars = analytics.ordersOverTime.map((d) => ({
    label: d.date.slice(5),
    value: d.orderCount,
    display: `${d.orderCount} · ${formatMoney(d.gmv, analytics.currency, locale)}`,
  }));

  return (
    <div className="mt-8 space-y-8 animate-page-enter" dir={direction}>
      {setupIncomplete ? (
        <section className="app-card border-s-[3px] border-s-[var(--primary)] p-5">
          <p className="font-semibold text-[var(--foreground)]">{ui.setupTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {ui.setupProgress.replace("{done}", String(setup.completedCount)).replace("{total}", String(setup.totalSteps))}
          </p>
          <Link href="/vendor/setup" className="mt-3 inline-block text-sm font-semibold text-link hover:underline">
            {ui.setupCta}
          </Link>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.sectionOverview}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.todayOrders}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{analytics.today.orderCount}</p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.todayGmv}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(analytics.today.gmv, analytics.currency, locale)}
            </p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.todayItems}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{analytics.today.itemsSold}</p>
          </div>
        </div>

        <div className="mt-4 app-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.catalogTitle}</h3>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-[var(--muted)]">{ui.productsTotal}</p>
              <p className="text-2xl font-semibold tabular-nums">{snapshot.productsTotal}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{ui.activeCoupons}</p>
              <p className="text-2xl font-semibold tabular-nums">{snapshot.activeCoupons}</p>
            </div>
          </div>
          {snapshot.productsByStatus.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {snapshot.productsByStatus.map((s) => (
                <li
                  key={s.status}
                  className="rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--surface))] px-3 py-1 text-xs tabular-nums"
                >
                  {ui.productStatusLabels[s.status] ?? s.status}: {s.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">{ui.emptyChart}</p>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="app-card p-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.monthThis}</h3>
            <p className="mt-2 tabular-nums text-lg">
              {analytics.monthCompare.thisMonth.orderCount} · {formatMoney(analytics.monthCompare.thisMonth.gmv, analytics.currency, locale)}
            </p>
            <h3 className="mt-4 text-sm font-semibold text-[var(--muted)]">{ui.monthLast}</h3>
            <p className="mt-1 tabular-nums">
              {analytics.monthCompare.lastMonth.orderCount} · {formatMoney(analytics.monthCompare.lastMonth.gmv, analytics.currency, locale)}
            </p>
          </div>
          <div className="app-card p-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.ordersByStatus}</h3>
            {statusBars.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">{ui.emptyChart}</p>
            ) : (
              <BarChart items={statusBars} />
            )}
          </div>
        </div>

        <div className="mt-4 app-card p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.ordersOverTime}</h3>
          {trendBars.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">{ui.emptyChart}</p>
          ) : (
            <BarChart items={trendBars} />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.sectionShortcuts}</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          <li>
            <Link href="/vendor/products" className="btn-secondary">
              {ui.linkProducts}
            </Link>
          </li>
          <li>
            <Link href="/vendor/orders" className="btn-secondary">
              {ui.linkOrders}
            </Link>
          </li>
          <li>
            <Link href="/vendor/coupons" className="btn-secondary">
              {ui.linkCoupons}
            </Link>
          </li>
          <li>
            <Link href="/vendor/payout" className="btn-secondary">
              {ui.linkPayout}
            </Link>
          </li>
          <li>
            <Link href="/vendor/store" className="btn-secondary">
              {ui.linkStore}
            </Link>
          </li>
          <li>
            <Link href="/vendor/setup" className="btn-primary">
              {ui.linkSetup}
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

