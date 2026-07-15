import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStoreBySlug } from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import StoreProductsGrid from "@/components/catalog/StoreProductsGrid";
import { getAppLocale } from "@/lib/ui-locale";
import { getActiveMarket } from "@/lib/market-server";

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const store = await getPublicStoreBySlug(slug, locale, market.id);
  if (!store) {
    return { title: "Store not found" };
  }
  const title = store.metaTitle?.trim() || store.storeName;
  const description =
    store.metaDescription?.trim() ||
    store.about?.trim() ||
    `${store.storeName} — ${store.city}, ${store.countryCode}`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function PublicStorePage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const store = await getPublicStoreBySlug(slug, locale, market.id);
  if (!store) notFound();
  const ui = locale === "ar" ? ar.publicStores : en.publicStores;
  const catalogUi = locale === "ar" ? ar.productCatalog : en.productCatalog;
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="flex flex-1 flex-col animate-page-enter" dir={direction}>
      <div
        className="h-44 w-full border-b border-[var(--border)]"
        style={{
          background: store.bannerUrl
            ? `url(${store.bannerUrl}) center/cover`
            : "linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, var(--surface)), color-mix(in srgb, var(--primary) 6%, var(--background)))",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl flex-1 px-6 pb-12">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-4 border-[var(--background)] bg-[var(--surface)] text-2xl font-bold text-[var(--primary)] shadow-[var(--shadow-md)]">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              store.storeName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">{store.storeName}</h1>
            <p className="text-sm text-[var(--muted)]">
              {ui.location}: {store.city}, {store.countryCode}
            </p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.tabProducts}</h2>
          <StoreProductsGrid
            slug={slug}
            locale={locale}
            ui={{
              noProducts: ui.noProducts,
              viewProduct: ui.viewProduct,
              loading: catalogUi.loading,
              loadError: catalogUi.loadError,
            }}
          />
        </section>

        {store.about ? (
          <section className="app-card mt-12 p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{ui.tabAbout}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">{store.about}</p>
          </section>
        ) : null}

        <p className="mt-8">
          <Link href="/stores" className="text-link text-sm font-medium">
            {ui.backToStores}
          </Link>
        </p>
      </div>
    </main>
  );
}
