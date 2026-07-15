import Link from "next/link";
import type { CustomerDashboardOverviewDto } from "@mlm/domain";
import CatalogProductThumb from "@/components/catalog/CatalogProductThumb";
import { formatMoney } from "@/lib/format-currency";

type CatalogUi = {
  soldBy: string;
  price: string;
  viewDetails: string;
};

type CustomerDashboardUi = {
  title: string;
  subtitle: string;
  welcomeNamed: string;
  welcomeGeneric: string;
  statsOrders: string;
  statsCartItems: string;
  browseCategories: string;
  featuredForYou: string;
  featuredSubtitle: string;
  fromYourOrdersCategories: string;
  fromYourOrdersCategoriesSubtitle: string;
  fromYourStores: string;
  fromYourStoresSubtitle: string;
  buyersAlsoBought: string;
  buyersAlsoBoughtSubtitle: string;
  viewAllProducts: string;
  noProductsInSection: string;
  openProfile: string;
  openOrders: string;
  openShop: string;
  openCart: string;
  openCheckout: string;
  openCashback: string;
  openAffiliate: string;
};

function ProductRowList({
  products,
  locale,
  catalogUi,
  empty,
}: {
  products: CustomerDashboardOverviewDto["featuredProducts"];
  locale: "en" | "ar";
  catalogUi: CatalogUi;
  empty: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";

  if (products.length === 0) {
    return <p className="app-card px-6 py-10 text-center text-sm text-[var(--muted)]">{empty}</p>;
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={`/products/${product.id}`}
            className="app-card app-card-hover flex h-full flex-col overflow-hidden"
          >
            <div className="relative aspect-[4/3] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]">
              <CatalogProductThumb
                src={product.imageUrl}
                alt={product.name}
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="flex flex-1 flex-col p-4" dir={direction}>
              <h3 className="line-clamp-2 font-semibold text-[var(--foreground)]">{product.name}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {catalogUi.soldBy}: {product.vendorName}
              </p>
              <p className="mt-auto pt-3 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {catalogUi.price}: {formatMoney(product.price, product.currency, locale)}
              </p>
              <span className="mt-2 text-sm font-medium text-[var(--primary)]">
                {catalogUi.viewDetails} {arrow}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerDashboardContent({
  locale,
  overview,
  ui,
  catalogUi,
}: {
  locale: "en" | "ar";
  overview: CustomerDashboardOverviewDto;
  ui: CustomerDashboardUi;
  catalogUi: CatalogUi;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";
  const isAnonymousFallback =
    overview.displayName === "there" || overview.displayName === "هناك";
  const welcome = isAnonymousFallback
    ? ui.welcomeGeneric
    : ui.welcomeNamed.replace("{name}", overview.displayName);

  return (
    <div className="dashboard-page-stagger flex flex-col gap-12" dir={direction}>
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-6 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 0% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 65%)",
          }}
        />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{welcome}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">{ui.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.statsOrders}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                {overview.stats.activeOrderCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{ui.statsCartItems}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                {overview.stats.cartItemCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="sr-only">{ui.title}</h2>
        <div className="flex flex-wrap gap-3 animate-stagger">
          <Link href="/profile" className="btn-primary btn-press">
            {ui.openProfile}
          </Link>
          <Link href="/orders" className="btn-secondary btn-press">
            {ui.openOrders}
          </Link>
          <Link href="/products" className="btn-secondary btn-press">
            {ui.openShop}
          </Link>
          <Link href="/cart" className="btn-secondary btn-press">
            {ui.openCart}
          </Link>
          <Link href="/checkout" className="btn-secondary btn-press">
            {ui.openCheckout}
          </Link>
          <Link
            href="/cashback"
            className="btn-secondary btn-press border-[color-mix(in_srgb,var(--success)_40%,var(--border-strong))] text-[var(--success)]"
          >
            {ui.openCashback}
          </Link>
          <Link
            href="/affiliate"
            className="btn-secondary btn-press border-[color-mix(in_srgb,var(--primary)_35%,var(--border-strong))] text-[var(--primary)]"
          >
            {ui.openAffiliate}
          </Link>
        </div>
      </section>

      {overview.categories.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ui.browseCategories}</h2>
            <Link href="/products" className="text-sm font-medium text-[var(--primary)] hover:underline">
              {ui.viewAllProducts} {arrow}
            </Link>
          </div>
          <ul
            className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 animate-stagger"
            role="list"
          >
            {overview.categories.map((cat) => (
              <li key={cat.id} className="min-w-0">
                <Link
                  href={`/products?categoryId=${encodeURIComponent(cat.id)}`}
                  className="app-card app-card-hover flex h-full flex-col overflow-hidden p-0 text-center transition"
                  role="listitem"
                >
                  <div className="relative aspect-[4/3] w-full bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
                    {cat.coverImageUrl ? (
                      <CatalogProductThumb
                        src={cat.coverImageUrl}
                        alt={cat.name}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-3xl font-bold text-[var(--primary)]"
                        aria-hidden
                      >
                        {cat.name.trim().charAt(0).toUpperCase() || "·"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3" dir={direction}>
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--foreground)]">
                      {cat.name}
                    </span>
                    <span className="mt-1 text-xs tabular-nums text-[var(--muted)]">{cat.productCount}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_2%,var(--background))] px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ui.featuredForYou}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.featuredSubtitle}</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-[var(--primary)] hover:underline">
            {ui.viewAllProducts} {arrow}
          </Link>
        </div>
        <ProductRowList
          products={overview.featuredProducts}
          locale={locale}
          catalogUi={catalogUi}
          empty={ui.noProductsInSection}
        />
      </section>

      {/* {overview.fromYourCategories.length > 0 ? (
        <section>
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ui.fromYourOrdersCategories}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.fromYourOrdersCategoriesSubtitle}</p>
          </div>
          <ProductRowList
            products={overview.fromYourCategories}
            locale={locale}
            catalogUi={catalogUi}
            empty={ui.noProductsInSection}
          />
        </section>
      ) : null} */}

      {overview.fromYourStores.length > 0 ? (
        <section>
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ui.fromYourStores}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.fromYourStoresSubtitle}</p>
          </div>
          <ProductRowList
            products={overview.fromYourStores}
            locale={locale}
            catalogUi={catalogUi}
            empty={ui.noProductsInSection}
          />
        </section>
      ) : null}

      {overview.buyersAlsoBought.length > 0 ? (
        <section>
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">{ui.buyersAlsoBought}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.buyersAlsoBoughtSubtitle}</p>
          </div>
          <ProductRowList
            products={overview.buyersAlsoBought}
            locale={locale}
            catalogUi={catalogUi}
            empty={ui.noProductsInSection}
          />
        </section>
      ) : null}
    </div>
  );
}
