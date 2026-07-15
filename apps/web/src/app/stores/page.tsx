import Link from "next/link";
import { listPublicStores } from "@mlm/domain";
import Pagination from "@/components/Pagination";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { getPaginationLabels } from "@/lib/pagination-labels";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket } from "@/lib/market-server";

const PAGE_SIZE = 5;

export default async function StoresListPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string }>;
}>) {
  const locale = await getAppLocale();
  const ui = locale === "ar" ? ar.publicStores : en.publicStores;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const market = await getActiveMarket();
  const { items, total } = await listPublicStores({ page, pageSize: PAGE_SIZE, marketId: market.id });

  return (
    <PageShell dir={direction}>
      <PageHeader title={ui.listTitle} subtitle={ui.listSubtitle} />

      {items.length === 0 ? (
        <p className="app-empty px-6 py-12 text-center text-sm">
          {ui.empty}{" "}
          <Link href="/sell" className="text-link font-medium">
            {locale === "ar" ? ar.siteFooter.becomeSeller : en.siteFooter.becomeSeller}
          </Link>
        </p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
            {items.map((store) => (
              <li key={store.id}>
                <Link href={`/stores/${store.slug}`} className="app-card app-card-hover block p-5">
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] text-xl font-bold text-[var(--primary)]"
                    aria-hidden
                  >
                    {store.storeName.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">{store.storeName}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {store.city}, {store.countryCode}
                  </p>
                  <p className="mt-3 text-sm font-medium text-[var(--primary)]">
                    {store.productCount} {ui.products} · {ui.viewStore} {arrow}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            linkBasePath="/stores"
            labels={getPaginationLabels(locale)}
            className="mt-6"
          />
        </>
      )}
    </PageShell>
  );
}
