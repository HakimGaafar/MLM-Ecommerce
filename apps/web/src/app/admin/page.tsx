import Link from "next/link";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAdminDashboardOverview } from "@mlm/domain";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { getActiveMarket } from "@/lib/market-server";
import { formatMoney } from "@/lib/format-currency";

export default async function AdminDashboardPage() {
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.adminDashboard;
  const statusLabels = dict.adminAnalytics.orderStatusLabels;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const market = await getActiveMarket();
  const overview = await getAdminDashboardOverview(market.id);

  const opCards: { href: string; label: string; count: number; emphasize?: boolean }[] = [
    {
      href: "/admin/users",
      label: ui.opsUsers,
      count: overview.counts.users,
    },
    {
      href: "/admin/vendors",
      label: ui.opsVendors,
      count: overview.counts.vendors,
    },
    {
      href: "/admin/products/pending",
      label: ui.opsPendingProducts,
      count: overview.counts.productsPendingApproval,
      emphasize: overview.counts.productsPendingApproval > 0,
    },
    {
      href: "/admin/shipping/requests",
      label: ui.opsPendingShipping,
      count: 0,
    },
    {
      href: "/admin/returns",
      label: ui.opsReturns,
      count: overview.counts.returnsInProgress,
    },
    {
      href: "/admin/orders/stuck",
      label: dict.adminOrderOps.dashboard.stuckGroups,
      count: overview.counts.stuckFulfillmentGroups,
      emphasize: overview.counts.stuckFulfillmentGroups > 0,
    },
    {
      href: "/admin/affiliates",
      label: ui.opsAffiliates,
      count: overview.counts.affiliatesActive,
    },
    {
      href: "/admin/settlements",
      label: ui.opsSettlements,
      count: overview.counts.pendingSettlements,
      emphasize: overview.counts.pendingSettlements > 0,
    },
    {
      href: "/admin/withdrawals",
      label: ui.opsWithdrawals,
      count: overview.counts.withdrawalsPending,
    },
    {
      href: "/admin/kyc",
      label: ui.opsKyc,
      count: overview.counts.kycPendingReview,
      emphasize: overview.counts.kycPendingReview > 0,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <h1 className="text-2xl font-semibold">{ui.title}</h1>
      <p className="mt-3 text-[var(--muted)]">{ui.subtitle}</p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.sectionMarketplace}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.cardTotalOrders}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{overview.marketplace.totalOrders}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">{ui.cardTotalOrdersHint}</p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.cardGmv}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(overview.marketplace.totalGmv, overview.currency, locale)}
            </p>
          </div>
          <div className="app-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.cardAov}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(overview.marketplace.averageOrderValue, overview.currency, locale)}
            </p>
          </div>
        </div>

        {overview.ordersByStatus.length > 0 ? (
          <div className="mt-4 app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.pipelineTitle}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {overview.ordersByStatus.map((s) => (
                <li
                  key={s.status}
                  className="rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--surface))] px-3 py-1 text-xs tabular-nums"
                >
                  {(statusLabels as Record<string, string>)[s.status] ?? s.status}: {s.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-3">
          <Link
            href="/admin/analytics"
            className="text-sm font-medium text-link hover:underline"
          >
            {ui.linkFullAnalytics}
          </Link>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.sectionOperations}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {opCards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className={`app-card app-card-hover flex h-full flex-col justify-between gap-2 p-4 transition ${
                  c.emphasize
                    ? "ring-2 ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">{c.label}</span>
                  <span className="text-xl font-semibold tabular-nums text-[var(--primary)]">{c.count}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">{ui.openSection}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.sectionShortcuts}</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          <li>
            <Link href="/admin/analytics" className="btn-secondary btn-press inline-flex">
              {ui.linkAnalytics}
            </Link>
          </li>
          <li>
            <Link href="/admin/products/pending" className="btn-secondary btn-press inline-flex">
              {ui.linkPendingProducts}
            </Link>
          </li>
          <li>
            <Link href="/admin/orders" className="btn-secondary btn-press">
              {ui.linkOrders}
            </Link>
          </li>
          <li>
            <Link href="/admin/returns" className="btn-secondary btn-press">
              {ui.linkReturns}
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="btn-secondary btn-press">
              {ui.linkUsers}
            </Link>
          </li>
          <li>
            <Link href="/admin/vendors" className="btn-secondary btn-press">
              {ui.linkVendors}
            </Link>
          </li>
          <li>
            <Link href="/admin/affiliates" className="btn-secondary btn-press">
              {ui.linkAffiliates}
            </Link>
          </li>
          <li>
            <Link href="/admin/settlements" className="btn-secondary btn-press">
              {ui.linkSettlements}
            </Link>
          </li>
          <li>
            <Link href="/admin/withdrawals" className="btn-secondary btn-press">
              {ui.linkWithdrawals}
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
