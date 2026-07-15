import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProductById } from "@mlm/domain";
import ProductImageGallery from "@/components/catalog/ProductImageGallery";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { getAppLocale } from "@/lib/ui-locale";
import { getServerSession } from "@/lib/server-session";
import { getActiveMarket } from "@/lib/market-server";
import { formatMoney } from "@/lib/format-currency";
import AddToCart from "./AddToCart";
import ProductQuestions from "./ProductQuestions";

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>): Promise<Metadata> {
  const { id } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const product = await getPublicProductById(id, locale, market.id);
  if (!product) {
    return { title: "Product not found" };
  }
  const title = product.metaTitle?.trim() || product.name;
  const description =
    product.metaDescription?.trim() || `${product.name} — ${product.vendorName}`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ProductDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const locale = await getAppLocale();
  const market = await getActiveMarket();
  const product = await getPublicProductById(id, locale, market.id);
  if (!product) {
    notFound();
  }

  const session = await getServerSession();
  const ui = locale === "ar" ? ar.productCatalog : en.productCatalog;
  const qnaUi = locale === "ar" ? ar.productQuestions : en.productQuestions;
  const addUi = locale === "ar" ? ar.addToCart : en.addToCart;
  const toastDict = locale === "ar" ? ar.toast : en.toast;
  const loginUi = locale === "ar" ? ar.login : en.login;
  const direction = locale === "ar" ? "rtl" : "ltr";

  const canAddToCart = Boolean(session?.roles?.includes("CUSTOMER"));

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
        <p className="mt-3 text-sm text-[var(--muted)]">
          {ui.soldBy}: <span className="font-medium text-[var(--foreground)]">{product.vendorName}</span>
        </p>
        <p className="mt-6 text-lg font-semibold tabular-nums text-[var(--foreground)]">
          {ui.price}: {formatMoney(product.price, product.currency, locale)}
        </p>

        {canAddToCart ? (
          <>
            <AddToCart
              productId={product.id}
              ui={addUi}
              viewCartLabel={ui.viewCart}
              toastAdded={toastDict.addedToCart}
            />
            <p className="mt-4 text-sm text-[var(--muted)]">{ui.checkoutNextStep}</p>
          </>
        ) : (
          <div className="mt-8 space-y-3 border-t border-[var(--border)] pt-6">
            <p className="text-sm text-[var(--muted)]">{ui.loginToAdd}</p>
            <Link href="/login" className="btn-primary">
              {loginUi.title}
            </Link>
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
      <ProductQuestions productId={product.id} locale={locale} ui={qnaUi} canAsk={canAddToCart} />
    </main>
  );
}

