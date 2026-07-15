import Link from "next/link";
import CatalogProductThumb from "@/components/catalog/CatalogProductThumb";
import { formatMoney } from "@/lib/format-currency";
import type { MarketBannerDto, PublicProductListItemDto } from "@mlm/domain";
import type { PublicStoreListItemDto } from "@mlm/domain";

type HomeUi = {
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  shopNow: string;
  exploreStores: string;
  signIn: string;
  createAccount: string;
  goToDashboard: string;
  sellWithUs: string;
  valueTitle: string;
  valueMultiVendor: string;
  valueMultiVendorDesc: string;
  valueCashback: string;
  valueCashbackDesc: string;
  valueCheckout: string;
  valueCheckoutDesc: string;
  valueSeller: string;
  valueSellerDesc: string;
  featuredProducts: string;
  featuredProductsSubtitle: string;
  viewAllProducts: string;
  featuredStores: string;
  featuredStoresSubtitle: string;
  viewAllStores: string;
  noProducts: string;
  noStores: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaRegister: string;
  ctaBrowse: string;
};

type CatalogUi = {
  soldBy: string;
  price: string;
  viewDetails: string;
};

type StoresUi = {
  products: string;
  viewStore: string;
};

const VALUE_ITEMS = [
  { key: "multi", titleKey: "valueMultiVendor" as const, descKey: "valueMultiVendorDesc" as const, icon: "🛍️" },
  { key: "cashback", titleKey: "valueCashback" as const, descKey: "valueCashbackDesc" as const, icon: "💳" },
  { key: "checkout", titleKey: "valueCheckout" as const, descKey: "valueCheckoutDesc" as const, icon: "📦" },
  { key: "seller", titleKey: "valueSeller" as const, descKey: "valueSellerDesc" as const, icon: "🏪" },
] as const;

export default function HomePageContent({
  locale,
  ui,
  catalogUi,
  storesUi,
  products,
  stores,
  banners = [],
  isLoggedIn,
}: {
  locale: "en" | "ar";
  ui: HomeUi;
  catalogUi: CatalogUi;
  storesUi: StoresUi;
  products: PublicProductListItemDto[];
  stores: PublicStoreListItemDto[];
  banners?: MarketBannerDto[];
  isLoggedIn: boolean;
  appName: string;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const arrow = locale === "ar" ? "←" : "→";
  const heroBanner = banners[0] ?? null;

  return (
    <div className="flex flex-1 flex-col animate-page-enter" dir={direction}>
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--primary) 28%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, var(--background)), var(--background))",
          }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 sm:py-20 lg:py-24">
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
            {ui.badge}
          </span>
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">
              {heroBanner?.title ?? ui.heroTitle}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
              {heroBanner?.subtitle ?? ui.heroSubtitle}
            </p>
            {heroBanner?.linkUrl ? (
              <Link
                href={heroBanner.linkUrl}
                className="mt-4 inline-flex text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {ui.shopNow} {arrow}
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary btn-press px-5 py-2.5">
              {ui.shopNow}
            </Link>
            <Link href="/stores" className="btn-secondary btn-press px-5 py-2.5">
              {ui.exploreStores}
            </Link>
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-secondary btn-press px-5 py-2.5">
                {ui.goToDashboard}
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary btn-press px-5 py-2.5">
                  {ui.signIn}
                </Link>
                <Link href="/register" className="btn-secondary btn-press px-5 py-2.5">
                  {ui.createAccount}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.valueTitle}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
          {VALUE_ITEMS.map((item) => (
            <li key={item.key} className="app-card p-5">
              <span className="text-2xl" aria-hidden>
                {item.icon}
              </span>
              <h3 className="mt-3 font-semibold text-[var(--foreground)]">{ui[item.titleKey]}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{ui[item.descKey]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--background))]">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">{ui.featuredProducts}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{ui.featuredProductsSubtitle}</p>
            </div>
            <Link href="/products" className="text-sm font-medium text-[var(--primary)] hover:underline">
              {ui.viewAllProducts} {arrow}
            </Link>
          </div>

          {products.length === 0 ? (
            <p className="app-card mt-8 px-6 py-12 text-center text-sm text-[var(--muted)]">{ui.noProducts}</p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
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
                    <div className="flex flex-1 flex-col p-4">
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
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">{ui.featuredStores}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{ui.featuredStoresSubtitle}</p>
          </div>
          <Link href="/stores" className="text-sm font-medium text-[var(--primary)] hover:underline">
            {ui.viewAllStores} {arrow}
          </Link>
        </div>

        {stores.length === 0 ? (
          <p className="app-card mt-8 px-6 py-12 text-center text-sm text-[var(--muted)]">{ui.noStores}</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/stores/${store.slug}`}
                  className="app-card block p-5 transition hover:border-[var(--primary)] hover:shadow-[var(--shadow-md)]"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] text-xl font-bold text-[var(--primary)]"
                    aria-hidden
                  >
                    {store.storeName.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{store.storeName}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {store.city}, {store.countryCode}
                  </p>
                  <p className="mt-3 text-sm font-medium text-[var(--primary)]">
                    {store.productCount} {storesUi.products} · {storesUi.viewStore} {arrow}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-14 text-center sm:py-16">
          <h2 className="max-w-xl text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">{ui.ctaTitle}</h2>
          <p className="max-w-lg text-sm leading-relaxed text-[var(--muted)] sm:text-base">{ui.ctaSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {!isLoggedIn ? (
              <Link href="/register" className="btn-primary btn-press px-5 py-2.5">
                {ui.ctaRegister}
              </Link>
            ) : null}
            <Link href="/products" className="btn-secondary btn-press px-5 py-2.5">
              {ui.ctaBrowse}
            </Link>
            <Link href="/sell" className="btn-secondary btn-press px-5 py-2.5">
              {ui.sellWithUs}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
