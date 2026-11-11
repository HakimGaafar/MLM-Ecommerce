import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProductRatingSummary,
  getPublicProductById,
  getRelatedProductsForProduct,
  isProductInWishlist,
} from "@mlm/domain";
import ProductImageGallery from "@/components/catalog/ProductImageGallery";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";
import { formatMoney } from "@/lib/format-currency";
import AddToCart from "./AddToCart";
import ProductQuestions from "./ProductQuestions";
import WishlistButton from "./WishlistButton";

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>): Promise<Metadata> {
  const { id } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const delivery = await resolveRequestCatalogDelivery({ marketCode: market.code });
  const product = await getPublicProductById(id, locale, market.id, delivery);
  if (!product) {
    const catalog = locale === "ar" ? ar.productCatalog : en.productCatalog;
    return { title: catalog.notFoundTitle };
  }
  const title = product.metaTitle?.trim() || product.name;
  const description =
    product.metaDescription?.trim() ||
    product.description?.trim() ||
    `${product.name} — ${product.vendorName}`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

function starsLabel(average: number, count: number, ui: { rating: string; ratingEmpty: string; ratingCount: string }) {
  if (count <= 0) return ui.ratingEmpty;
  return `${ui.rating}: ${average.toFixed(1)} · ${ui.ratingCount.replace("{count}", String(count))}`;
}

export default async function ProductDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const delivery = await resolveRequestCatalogDelivery({ marketCode: market.code });
  const product = await getPublicProductById(id, locale, market.id, delivery);
  if (!product) {
    notFound();
  }

  const session = await getServerSession();
  const ui = locale === "ar" ? ar.productCatalog : en.productCatalog;
  const wishlistUi = locale === "ar" ? ar.wishlist : en.wishlist;
  const qnaUi = locale === "ar" ? ar.productQuestions : en.productQuestions;
  const addUi = locale === "ar" ? ar.addToCart : en.addToCart;
  const toastDict = locale === "ar" ? ar.toast : en.toast;
  const loginUi = locale === "ar" ? ar.login : en.login;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const canAddToCart = Boolean(session?.roles?.includes("CUSTOMER"));
  const [rating, related, inWishlist] = await Promise.all([
    getProductRatingSummary(product.id),
    getRelatedProductsForProduct({
      productId: product.id,
      categoryId: product.categoryId,
      marketId: market.id,
      locale,
      delivery,
    }),
    canAddToCart && session?.sub
      ? isProductInWishlist(session.sub, market.id, product.id)
      : Promise.resolve(false),
  ]);

  const galleryUi = {
    prevImage: ui.prevImage,
    nextImage: ui.nextImage,
    zoomIn: ui.zoomIn,
    zoomOut: ui.zoomOut,
    close: ui.close,
    openGallery: ui.openGallery,
    imageOf: ui.imageOf,
  };

  const article = (
    <article className="app-card p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div>
          <ProductImageGallery
            images={product.images}
            productName={product.name}
            locale={locale}
            ui={galleryUi}
          />
        </div>
        <div className="p-2 sm:p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--primary)]">{product.categoryName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{product.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {starsLabel(rating.average, rating.count, ui)}
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {ui.soldBy}: <span className="font-medium text-[var(--foreground)]">{product.vendorName}</span>
        </p>
        <p className="mt-6 text-lg font-semibold tabular-nums text-[var(--foreground)]">
          {ui.price}: {formatMoney(product.price, product.currency, locale)}
        </p>

        {product.description ? (
          <div className="mt-6 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
            {product.description}
          </div>
        ) : null}

        {canAddToCart ? (
          <>
            <AddToCart
              productId={product.id}
              ui={addUi}
              viewCartLabel={ui.viewCart}
              toastAdded={toastDict.addedToCart}
              variants={product.variants}
            />
            <WishlistButton
              productId={product.id}
              initialInWishlist={inWishlist}
              canUse
              loginHref="/account/customer"
              ui={{
                add: wishlistUi.add,
                remove: wishlistUi.remove,
                added: wishlistUi.added,
                removed: wishlistUi.removed,
                failed: wishlistUi.failed,
                loginRequired: wishlistUi.loginRequired,
              }}
            />
            <p className="mt-4 text-sm text-[var(--muted)]">{ui.checkoutNextStep}</p>
          </>
        ) : (
          <div className="mt-8 space-y-3 border-t border-[var(--border)] pt-6">
            <p className="text-sm text-[var(--muted)]">{ui.loginToAdd}</p>
            <Link href="/account/customer" className="btn-primary">
              {loginUi.title}
            </Link>
            <WishlistButton
              productId={product.id}
              initialInWishlist={false}
              canUse={false}
              loginHref="/account/customer"
              ui={{
                add: wishlistUi.add,
                remove: wishlistUi.remove,
                added: wishlistUi.added,
                removed: wishlistUi.removed,
                failed: wishlistUi.failed,
                loginRequired: wishlistUi.loginRequired,
              }}
            />
          </div>
        )}
        </div>
      </div>
    </article>
  );

  const backToCatalog = (
    <Link href="/products" className="text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline">
      {locale === "ar" ? `${ui.backToList} →` : `← ${ui.backToList}`}
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-6 sm:p-8 animate-page-enter" dir={direction}>
      <div className="mb-6">{backToCatalog}</div>
      {article}
      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{ui.relatedTitle}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/products/${item.slug || item.id}`}
                  className="block rounded-xl border border-[var(--border)] p-3 transition hover:border-[var(--primary)]"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="mb-3 aspect-square w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-3 aspect-square w-full rounded-lg bg-[var(--surface-muted)]" />
                  )}
                  <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                  <p className="mt-1 text-sm tabular-nums text-[var(--muted)]">
                    {formatMoney(item.price, item.currency, locale)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ProductQuestions
        productId={product.id}
        locale={locale}
        ui={{ ...qnaUi, signIn: loginUi.title }}
        canAsk={canAddToCart}
      />
    </main>
  );
}
